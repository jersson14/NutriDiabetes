// ============================================
// Controller: Panel de Administración
// ============================================
const { query } = require('../config/database');

/**
 * GET /api/admin/stats
 * KPIs generales del sistema
 */
const getStats = async (req, res) => {
  try {
    const [usuarios, consultas, tokens, tiempos, feedback, pacientesDM2] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE activo = TRUE) AS activos,
          COUNT(*) FILTER (WHERE ultimo_acceso >= NOW() - INTERVAL '30 days') AS activos_30d,
          COUNT(*) FILTER (WHERE rol = 'PACIENTE') AS total_pacientes,
          COUNT(*) FILTER (WHERE rol = 'NUTRICIONISTA') AS total_nutricionistas,
          COUNT(*) FILTER (WHERE rol = 'ADMINISTRADOR') AS total_admins,
          COUNT(*) FILTER (WHERE DATE(fecha_creacion) = CURRENT_DATE) AS nuevos_hoy,
          COUNT(*) FILTER (WHERE fecha_creacion >= NOW() - INTERVAL '7 days') AS nuevos_7d
        FROM usuarios
      `),
      query(`
        SELECT
          COUNT(*) AS total_conversaciones,
          COUNT(*) FILTER (WHERE DATE(fecha_creacion) = CURRENT_DATE) AS hoy,
          COUNT(*) FILTER (WHERE fecha_creacion >= NOW() - INTERVAL '7 days') AS ultimos_7d,
          COALESCE(SUM(total_mensajes), 0) AS total_mensajes
        FROM conversaciones
      `),
      query(`
        SELECT
          COALESCE(SUM(tokens_entrada + tokens_salida), 0) AS total_tokens,
          COALESCE(SUM(tokens_entrada), 0) AS tokens_entrada,
          COALESCE(SUM(tokens_salida), 0) AS tokens_salida,
          COALESCE(ROUND(AVG(tokens_entrada + tokens_salida)::numeric, 0), 0) AS promedio_por_consulta
        FROM mensajes
        WHERE rol = 'ASSISTANT'
      `),
      query(`
        SELECT
          ROUND(AVG(tiempo_respuesta_ms)::numeric, 0) AS promedio_ms,
          ROUND(MIN(tiempo_respuesta_ms)::numeric, 0) AS min_ms,
          ROUND(MAX(tiempo_respuesta_ms)::numeric, 0) AS max_ms
        FROM mensajes
        WHERE rol = 'ASSISTANT' AND tiempo_respuesta_ms IS NOT NULL
      `),
      query(`
        SELECT
          ROUND(AVG(sus_score)::numeric, 2) AS sus_promedio,
          ROUND(AVG(calificacion)::numeric, 2) AS calificacion_promedio,
          ROUND(AVG(relevancia)::numeric, 2) AS relevancia_promedio,
          ROUND(AVG(utilidad)::numeric, 2) AS utilidad_promedio,
          COUNT(*) AS total_evaluaciones
        FROM feedback_usuario
      `),
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE clasificacion_dm2 = 'DM2_CONTROLADA') AS controlada,
          COUNT(*) FILTER (WHERE clasificacion_dm2 = 'DM2_NO_CONTROLADA') AS no_controlada,
          COUNT(*) FILTER (WHERE clasificacion_dm2 = 'PRE_DIABETES') AS pre_diabetes,
          COUNT(*) FILTER (WHERE clasificacion_dm2 = 'DM2_SIN_COMPLICACIONES') AS sin_complicaciones,
          COUNT(*) FILTER (WHERE clasificacion_dm2 = 'DM2_CON_COMPLICACIONES') AS con_complicaciones
        FROM perfiles_salud
      `)
    ]);

    res.json({
      usuarios: usuarios.rows[0],
      consultas: consultas.rows[0],
      tokens: tokens.rows[0],
      tiempos: tiempos.rows[0],
      feedback: feedback.rows[0],
      pacientes_dm2: pacientesDM2.rows[0]
    });
  } catch (error) {
    console.error('Error en admin stats:', error.message);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

/**
 * GET /api/admin/usuarios
 * Lista de todos los usuarios con métricas
 */
const getUsuarios = async (req, res) => {
  try {
    const { page = 1, limit = 25, rol, activo, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (rol) { conditions.push(`u.rol = $${idx++}`); params.push(rol); }
    if (activo !== undefined) { conditions.push(`u.activo = $${idx++}`); params.push(activo === 'true'); }
    if (search) {
      conditions.push(`(u.nombre_completo ILIKE $${idx} OR u.email ILIKE $${idx++})`);
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, parseInt(limit), offset];

    const result = await query(
      `SELECT
        u.id, u.email, u.nombre_completo, u.rol, u.activo,
        u.ultimo_acceso, u.fecha_creacion, u.avatar_url,
        COUNT(DISTINCT c.id)::integer AS total_conversaciones,
        COALESCE(SUM(m.tokens_entrada + m.tokens_salida), 0)::integer AS total_tokens,
        ROUND(AVG(m.tiempo_respuesta_ms)::numeric, 0) AS tiempo_promedio_ms,
        ps.clasificacion_dm2,
        ps.hemoglobina_glicosilada
       FROM usuarios u
       LEFT JOIN conversaciones c ON c.usuario_id = u.id
       LEFT JOIN mensajes m ON m.conversacion_id = c.id AND m.rol = 'ASSISTANT'
       LEFT JOIN perfiles_salud ps ON ps.usuario_id = u.id
       ${where}
       GROUP BY u.id, ps.clasificacion_dm2, ps.hemoglobina_glicosilada
       ORDER BY u.fecha_creacion DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      dataParams
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM usuarios u ${where}`,
      params
    );

    res.json({
      usuarios: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error en admin usuarios:', error.message);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

/**
 * GET /api/admin/metricas-rag
 * Métricas RAG + tokens por día + consultas por día
 */
const getMetricasRAG = async (req, res) => {
  try {
    const [metricas, tokensPorDia, consultasPorDia, tiempos] = await Promise.all([
      query(`
        SELECT tipo_metrica,
               COUNT(*)::integer AS total_mediciones,
               ROUND(AVG(valor)::numeric, 4) AS promedio,
               ROUND(MIN(valor)::numeric, 4) AS minimo,
               ROUND(MAX(valor)::numeric, 4) AS maximo,
               ROUND(STDDEV(valor)::numeric, 4) AS desviacion,
               modelo_llm
        FROM metricas_sistema
        GROUP BY tipo_metrica, modelo_llm
        ORDER BY tipo_metrica
      `),
      query(`
        SELECT
          DATE(m.fecha_creacion) AS fecha,
          SUM(m.tokens_entrada + m.tokens_salida)::integer AS tokens,
          SUM(m.tokens_entrada)::integer AS tokens_entrada,
          SUM(m.tokens_salida)::integer AS tokens_salida,
          COUNT(*)::integer AS mensajes,
          ROUND(AVG(m.tiempo_respuesta_ms)::numeric, 0) AS tiempo_promedio_ms
        FROM mensajes m
        WHERE m.rol = 'ASSISTANT'
          AND m.fecha_creacion >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(m.fecha_creacion)
        ORDER BY fecha ASC
      `),
      query(`
        SELECT
          DATE(fecha_creacion) AS fecha,
          COUNT(*)::integer AS consultas
        FROM conversaciones
        WHERE fecha_creacion >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(fecha_creacion)
        ORDER BY fecha ASC
      `),
      query(`
        SELECT
          ROUND(AVG(tiempo_respuesta_ms)::numeric, 0) AS promedio_ms,
          ROUND(MIN(tiempo_respuesta_ms)::numeric, 0) AS min_ms,
          ROUND(MAX(tiempo_respuesta_ms)::numeric, 0) AS max_ms,
          COUNT(*)::integer AS total_respuestas,
          ROUND(AVG(score_similitud_promedio)::numeric, 4) AS similitud_promedio,
          ROUND(AVG(chunks_recuperados)::numeric, 1) AS chunks_promedio
        FROM mensajes
        WHERE rol = 'ASSISTANT' AND tiempo_respuesta_ms IS NOT NULL
      `)
    ]);

    res.json({
      metricas_rag: metricas.rows,
      tokens_por_dia: tokensPorDia.rows,
      consultas_por_dia: consultasPorDia.rows,
      tiempos_respuesta: tiempos.rows[0]
    });
  } catch (error) {
    console.error('Error en métricas RAG:', error.message);
    res.status(500).json({ error: 'Error al obtener métricas RAG' });
  }
};

/**
 * GET /api/admin/consultas
 * Últimas consultas con métricas por conversación
 */
const getConsultas = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const lim    = parseInt(limit);
    const offset = (parseInt(page) - 1) * lim;

    const [result, total] = await Promise.all([
      query(
        `SELECT
          c.id, c.titulo, c.estado, c.total_mensajes, c.fecha_creacion,
          u.nombre_completo, u.email, u.rol,
          COALESCE(SUM(m.tokens_entrada + m.tokens_salida), 0)::integer AS tokens_totales,
          ROUND(AVG(m.tiempo_respuesta_ms)::numeric, 0) AS tiempo_promedio_ms,
          ROUND(AVG(m.score_similitud_promedio)::numeric, 4) AS similitud_promedio,
          COALESCE(AVG(m.chunks_recuperados), 0) AS chunks_promedio
         FROM conversaciones c
         JOIN usuarios u ON u.id = c.usuario_id
         LEFT JOIN mensajes m ON m.conversacion_id = c.id AND m.rol = 'ASSISTANT'
         GROUP BY c.id, u.nombre_completo, u.email, u.rol
         ORDER BY c.fecha_creacion DESC
         LIMIT $1 OFFSET $2`,
        [lim, offset]
      ),
      query(`SELECT COUNT(*) FROM conversaciones`),
    ]);

    res.json({ consultas: result.rows, total: parseInt(total.rows[0].count) });
  } catch (error) {
    console.error('Error en admin consultas:', error.message);
    res.status(500).json({ error: 'Error al obtener consultas' });
  }
};

/**
 * GET /api/admin/logs
 * Logs de actividad del sistema
 */
const getLogs = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const result = await query(
      `SELECT
        l.id, l.accion, l.entidad, l.ip_address, l.fecha_creacion,
        u.nombre_completo, u.email, u.rol
       FROM logs_actividad l
       JOIN usuarios u ON u.id = l.usuario_id
       ORDER BY l.fecha_creacion DESC
       LIMIT $1`,
      [parseInt(limit)]
    );

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Error en admin logs:', error.message);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
};

/**
 * PUT /api/admin/usuarios/:id/activo
 * Activar o desactivar un usuario
 */
const toggleUsuarioActivo = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'Campo activo requerido (boolean)' });
    }
    if (id === req.user.id) {
      return res.status(400).json({ error: 'No puedes modificar tu propia cuenta' });
    }

    const result = await query(
      `UPDATE usuarios
       SET activo = $1, fecha_actualizacion = NOW()
       WHERE id = $2
       RETURNING id, email, nombre_completo, rol, activo`,
      [activo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al cambiar estado de usuario:', error.message);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

/**
 * PUT /api/admin/usuarios/:id/rol
 */
const cambiarRolUsuario = async (req, res) => {
  try {
    const { rol } = req.body;
    const { id } = req.params;
    const ROLES = ['PACIENTE', 'NUTRICIONISTA', 'ADMINISTRADOR'];
    if (!ROLES.includes(rol)) {
      return res.status(400).json({ error: `rol debe ser: ${ROLES.join(', ')}` });
    }
    if (id === req.user.id) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
    }
    const result = await query(
      `UPDATE usuarios SET rol = $1, fecha_actualizacion = NOW()
       WHERE id = $2 RETURNING id, email, nombre_completo, rol`,
      [rol, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al cambiar rol:', error.message);
    res.status(500).json({ error: 'Error al cambiar rol' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GESTIÓN DE ALIMENTOS (PostgreSQL + Pinecone)
// ──────────────────────────────────────────────────────────────────────────────
const axios = require('axios');
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

/**
 * GET /api/admin/alimentos
 */
const getAlimentosAdmin = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT a.id, a.nombre, a.nombre_comun, ca.nombre AS categoria,
              a.energia_kcal, a.proteinas_g, a.carbohidratos_totales_g,
              a.fibra_dietaria_g, a.indice_glucemico, a.nivel_recomendacion,
              a.pinecone_id, a.embedding_generado, a.activo, a.fecha_creacion
       FROM alimentos a
       LEFT JOIN categorias_alimentos ca ON ca.id = a.categoria_id
       WHERE ($1 = '' OR a.nombre ILIKE $2 OR a.nombre_comun ILIKE $2)
       ORDER BY a.fecha_creacion DESC
       LIMIT $3 OFFSET $4`,
      [search, `%${search}%`, parseInt(limit), offset]
    );

    const total = await query(
      `SELECT COUNT(*) FROM alimentos a
       WHERE ($1 = '' OR a.nombre ILIKE $2 OR a.nombre_comun ILIKE $2)`,
      [search, `%${search}%`]
    );

    res.json({ alimentos: result.rows, total: parseInt(total.rows[0].count) });
  } catch (error) {
    console.error('Error getAlimentosAdmin:', error.message);
    res.status(500).json({ error: 'Error al obtener alimentos' });
  }
};

/**
 * POST /api/admin/alimentos
 * Crea alimento en PostgreSQL y lo envía a Pinecone via AI Service
 */
const crearAlimento = async (req, res) => {
  try {
    const {
      nombre, nombre_comun, categoria_id,
      energia_kcal, proteinas_g, carbohidratos_totales_g,
      grasas_totales_g, fibra_dietaria_g, calcio_mg, hierro_mg,
      vitamina_c_mg, indice_glucemico, nivel_recomendacion,
      es_apto_diabeticos, notas
    } = req.body;

    if (!nombre || !categoria_id) {
      return res.status(400).json({ error: 'nombre y categoria_id son requeridos' });
    }

    const cg = indice_glucemico && carbohidratos_totales_g
      ? Math.round(parseFloat(indice_glucemico) * parseFloat(carbohidratos_totales_g) / 100 * 10) / 10
      : null;

    // 1. Insertar en PostgreSQL
    const result = await query(
      `INSERT INTO alimentos (
        nombre, nombre_comun, categoria_id,
        energia_kcal, proteinas_g, carbohidratos_totales_g,
        grasas_totales_g, fibra_dietaria_g, calcio_mg, hierro_mg,
        vitamina_c_mg, indice_glucemico, carga_glucemica,
        nivel_recomendacion, es_apto_diabeticos, notas, activo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE)
      RETURNING *`,
      [
        nombre, nombre_comun || null, parseInt(categoria_id),
        energia_kcal || null, proteinas_g || null, carbohidratos_totales_g || null,
        grasas_totales_g || null, fibra_dietaria_g || null,
        calcio_mg || null, hierro_mg || null, vitamina_c_mg || null,
        indice_glucemico || null, cg,
        nivel_recomendacion || 'RECOMENDADO',
        es_apto_diabeticos !== false,
        notas || null
      ]
    );

    const alimento = result.rows[0];
    let pinecone_ok = false;
    let pinecone_error = null;

    // 2. Enviar a Pinecone via AI Service (opcional — no bloquea si falla)
    try {
      await axios.post(`${RAG_SERVICE_URL}/api/embeddings/generate`, {
        alimentos: [{
          id:       `admin_${alimento.id}`,
          metadata: {
            nombre:              alimento.nombre,
            nombre_comun:        alimento.nombre_comun || '',
            energia_kcal:        parseFloat(alimento.energia_kcal) || 0,
            proteinas_g:         parseFloat(alimento.proteinas_g) || 0,
            carbohidratos_g:     parseFloat(alimento.carbohidratos_totales_g) || 0,
            grasas_g:            parseFloat(alimento.grasas_totales_g) || 0,
            fibra_g:             parseFloat(alimento.fibra_dietaria_g) || 0,
            indice_glucemico:    parseInt(alimento.indice_glucemico) || 0,
            carga_glucemica:     parseFloat(alimento.carga_glucemica) || 0,
            nivel_recomendacion: alimento.nivel_recomendacion,
            es_apto_diabeticos:  alimento.es_apto_diabeticos,
            notas:               alimento.notas || '',
          }
        }]
      }, { timeout: 30000 });

      // Marcar que el embedding fue generado
      await query(
        `UPDATE alimentos SET embedding_generado=TRUE, pinecone_id=$1 WHERE id=$2`,
        [`admin_${alimento.id}`, alimento.id]
      );
      pinecone_ok = true;
    } catch (e) {
      pinecone_error = e.message;
      console.warn('⚠️ No se pudo agregar a Pinecone:', e.message);
    }

    res.status(201).json({ alimento, pinecone_ok, pinecone_error });
  } catch (error) {
    console.error('Error crearAlimento:', error.message);
    res.status(500).json({ error: 'Error al crear alimento' });
  }
};

/**
 * DELETE /api/admin/alimentos/:id
 */
const eliminarAlimento = async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM alimentos WHERE id = $1 RETURNING id, nombre`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alimento no encontrado' });
    }
    res.json({ mensaje: 'Alimento eliminado', alimento: result.rows[0] });
  } catch (error) {
    console.error('Error eliminarAlimento:', error.message);
    res.status(500).json({ error: 'Error al eliminar alimento' });
  }
};

module.exports = {
  getStats, getUsuarios, getMetricasRAG, getConsultas, getLogs,
  toggleUsuarioActivo, cambiarRolUsuario,
  getAlimentosAdmin, crearAlimento, eliminarAlimento,
};
