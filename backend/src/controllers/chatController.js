// ============================================
// Controller: Chat / Conversaciones RAG
// ============================================
const { query, transaction } = require('../config/database');
const axios = require('axios');

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

/**
 * POST /api/chat/message
 * Enviar mensaje al chatbot RAG
 */
const sendMessage = async (req, res) => {
  try {
    const { conversacionId, mensaje } = req.body;
    const userId = req.user.id;

    if (!mensaje || mensaje.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }

    let convId = conversacionId;

    // Si no hay conversación, crear una nueva
    if (!convId) {
      // Obtener perfil de salud para contexto
      const perfilResult = await query(
        `SELECT * FROM perfiles_salud WHERE usuario_id = $1`,
        [userId]
      );

      const contextSalud = perfilResult.rows.length > 0 ? perfilResult.rows[0] : null;

      const convResult = await query(
        `INSERT INTO conversaciones (usuario_id, titulo, contexto_salud)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, mensaje.substring(0, 100), JSON.stringify(contextSalud)]
      );
      convId = convResult.rows[0].id;
    }

    // Obtener el orden del siguiente mensaje
    const ordenResult = await query(
      `SELECT COALESCE(MAX(orden), 0) + 1 AS next_orden
       FROM mensajes WHERE conversacion_id = $1`,
      [convId]
    );
    const ordenUser = ordenResult.rows[0].next_orden;

    // Guardar mensaje del usuario
    await query(
      `INSERT INTO mensajes (conversacion_id, rol, contenido, orden)
       VALUES ($1, 'USER', $2, $3)`,
      [convId, mensaje, ordenUser]
    );

    // Obtener perfil del usuario para contexto RAG
    const perfilResult = await query(
      `SELECT ps.*, on2.carbohidratos_por_comida_max_g,
              on2.calorias_diarias_max, on2.glucosa_objetivo_max
       FROM perfiles_salud ps
       LEFT JOIN objetivos_nutricionales on2 ON ps.usuario_id = on2.usuario_id
       WHERE ps.usuario_id = $1`,
      [userId]
    );

    const perfil = perfilResult.rows[0] || {};

    // Obtener historial de conversación (últimos 6 mensajes para contexto)
    const historial = await query(
      `SELECT rol, contenido FROM mensajes
       WHERE conversacion_id = $1
       ORDER BY orden DESC LIMIT 6`,
      [convId]
    );

    // Obtener últimas mediciones de glucosa para contexto clínico real
    const glucosaReciente = await query(
      `SELECT valor_mg_dl, tipo_medicion, esta_en_rango, fecha_medicion
       FROM registros_glucosa
       WHERE usuario_id = $1
       ORDER BY fecha_medicion DESC LIMIT 7`,
      [userId]
    );

    // Calcular métricas de glucosa para el contexto RAG
    const glucosaRows = glucosaReciente.rows;
    const promedioGlucosa = glucosaRows.length > 0
      ? Math.round(glucosaRows.reduce((s, r) => s + parseFloat(r.valor_mg_dl), 0) / glucosaRows.length)
      : null;
    const eHbA1c = promedioGlucosa
      ? ((promedioGlucosa + 46.7) / 28.7).toFixed(1)
      : null;
    const tirPct = glucosaRows.length > 0
      ? Math.round((glucosaRows.filter(r => r.esta_en_rango).length / glucosaRows.length) * 100)
      : null;

    // Llamar al microservicio RAG
    let respuestaRAG;
    const startTime = Date.now();

    try {
      const ragResponse = await axios.post(`${RAG_SERVICE_URL}/api/recommend`, {
        mensaje,
        perfil_salud: {
          clasificacion_dm2:        perfil.clasificacion_dm2,
          hemoglobina_glicosilada:  perfil.hemoglobina_glicosilada,
          usa_insulina:             perfil.usa_insulina,
          usa_metformina:           perfil.usa_metformina,
          alergias:                 perfil.alergias,
          intolerancias:            perfil.intolerancias,
          restricciones:            perfil.restricciones_dieteticas,
          carbohidratos_max:        perfil.carbohidratos_por_comida_max_g,
          calorias_max:             perfil.calorias_diarias_max,
          // Contexto glucémico real del paciente
          glucosa_reciente:         glucosaRows.map(r => ({
            valor:  r.valor_mg_dl,
            tipo:   r.tipo_medicion,
            fecha:  r.fecha_medicion
          })),
          glucosa_promedio_reciente: promedioGlucosa,
          hba1c_estimada:           eHbA1c,
          tiempo_en_rango_pct:      tirPct,
        },
        historial: historial.rows.reverse(),
      }, { timeout: 30000 });

      respuestaRAG = ragResponse.data;
    } catch (ragError) {
      console.error('⚠️ RAG service error:', ragError.message);
      // Fallback: respuesta sin RAG
      respuestaRAG = {
        respuesta: 'Lo siento, el servicio de recomendaciones no está disponible temporalmente. Por favor, intenta de nuevo en unos momentos.',
        contexto_recuperado: null,
        modelo_llm: 'fallback',
        tokens_entrada: 0,
        tokens_salida: 0,
        score_similitud: 0,
        chunks_recuperados: 0
      };
    }

    const tiempoRespuesta = Date.now() - startTime;

    // Guardar mensaje del asistente
    const msgResult = await query(
      `INSERT INTO mensajes (
        conversacion_id, rol, contenido, orden,
        contexto_recuperado, modelo_llm,
        tokens_entrada, tokens_salida,
        tiempo_respuesta_ms, score_similitud_promedio,
        chunks_recuperados
      ) VALUES ($1, 'ASSISTANT', $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        convId,
        respuestaRAG.respuesta,
        ordenUser + 1,
        JSON.stringify(respuestaRAG.contexto_recuperado),
        respuestaRAG.modelo_llm || 'gpt-4',
        respuestaRAG.tokens_entrada || 0,
        respuestaRAG.tokens_salida || 0,
        tiempoRespuesta,
        respuestaRAG.score_similitud || 0,
        respuestaRAG.chunks_recuperados || 0
      ]
    );

    // Si hay recomendación estructurada, guardarla
    if (respuestaRAG.recomendacion) {
      const rec = respuestaRAG.recomendacion;
      await query(
        `INSERT INTO recomendaciones (
          conversacion_id, mensaje_id, usuario_id,
          titulo, descripcion, tipo,
          calorias_totales, carbohidratos_totales_g,
          proteinas_totales_g, grasas_totales_g,
          fibra_total_g, indice_glucemico_estimado,
          tiempo_preparacion_min, dificultad,
          es_segura_para_diabeticos
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          convId, msgResult.rows[0].id, userId,
          rec.titulo || 'Recomendación nutricional',
          rec.descripcion || respuestaRAG.respuesta,
          rec.tipo || 'RECETA',
          rec.calorias, rec.carbohidratos,
          rec.proteinas, rec.grasas,
          rec.fibra, rec.indice_glucemico,
          rec.tiempo_preparacion, rec.dificultad,
          rec.es_segura !== false
        ]
      );
    }

    // Registrar métrica para tesis
    if (respuestaRAG.score_similitud) {
      await query(
        `INSERT INTO metricas_sistema (
          tipo_metrica, nombre, valor, unidad,
          conversacion_id, mensaje_id, usuario_id,
          modelo_llm, total_chunks_recuperados, evaluado_por
        ) VALUES ('COSENO', 'Similitud promedio', $1, 'score', $2, $3, $4, $5, $6, 'SISTEMA')`,
        [
          respuestaRAG.score_similitud,
          convId, msgResult.rows[0].id, userId,
          respuestaRAG.modelo_llm, respuestaRAG.chunks_recuperados
        ]
      );
    }

    res.json({
      conversacionId: convId,
      mensaje: {
        id: msgResult.rows[0].id,
        rol: 'ASSISTANT',
        contenido: respuestaRAG.respuesta,
        tiempoRespuesta
      },
      fuentes: respuestaRAG.fuentes_formateadas || [],
      recomendacion: respuestaRAG.recomendacion || null
    });
  } catch (error) {
    console.error('Error en chat:', error.message);
    res.status(500).json({ error: 'Error al procesar mensaje' });
  }
};

/**
 * GET /api/chat/conversaciones
 * Listar conversaciones del usuario
 */
const getConversaciones = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, titulo, estado, total_mensajes, fecha_creacion
       FROM conversaciones
       WHERE usuario_id = $1
       ORDER BY fecha_actualizacion DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({ conversaciones: result.rows });
  } catch (error) {
    console.error('Error al listar conversaciones:', error.message);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
};

/**
 * GET /api/chat/conversacion/:id
 * Obtener mensajes de una conversación
 */
const getConversacion = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la conversación pertenece al usuario
    const convResult = await query(
      `SELECT * FROM conversaciones WHERE id = $1 AND usuario_id = $2`,
      [id, req.user.id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    // Obtener mensajes
    const mensajes = await query(
      `SELECT id, rol, contenido, tiempo_respuesta_ms, fecha_creacion
       FROM mensajes
       WHERE conversacion_id = $1
       ORDER BY orden ASC`,
      [id]
    );

    // Obtener recomendaciones asociadas
    const recomendaciones = await query(
      `SELECT id, titulo, tipo, calorias_totales, carbohidratos_totales_g,
              indice_glucemico_estimado, tiempo_preparacion_min, dificultad
       FROM recomendaciones
       WHERE conversacion_id = $1
       ORDER BY fecha_creacion ASC`,
      [id]
    );

    res.json({
      conversacion: convResult.rows[0],
      mensajes: mensajes.rows,
      recomendaciones: recomendaciones.rows
    });
  } catch (error) {
    console.error('Error al obtener conversación:', error.message);
    res.status(500).json({ error: 'Error al obtener conversación' });
  }
};

/**
 * DELETE /api/chat/conversacion/:id
 * Eliminar conversación
 */
const deleteConversacion = async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM conversaciones WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    res.json({ message: 'Conversación eliminada' });
  } catch (error) {
    console.error('Error al eliminar conversación:', error.message);
    res.status(500).json({ error: 'Error al eliminar conversación' });
  }
};

module.exports = {
  sendMessage,
  getConversaciones,
  getConversacion,
  deleteConversacion
};
