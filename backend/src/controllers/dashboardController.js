// ============================================
// Controller: Dashboard / Analytics
// ============================================
const { query } = require('../config/database');

/**
 * GET /api/dashboard
 * Dashboard principal del paciente
 */
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Última medición de glucosa
    const ultimaGlucosa = await query(
      `SELECT valor_mg_dl, tipo_medicion, esta_en_rango, fecha_medicion
       FROM registros_glucosa
       WHERE usuario_id = $1
       ORDER BY fecha_medicion DESC LIMIT 1`,
      [userId]
    );

    // 2. Promedio de glucosa últimos 7 días
    const promedioGlucosa7d = await query(
      `SELECT ROUND(AVG(valor_mg_dl)::numeric, 1) AS promedio,
              COUNT(*) AS mediciones
       FROM registros_glucosa
       WHERE usuario_id = $1
         AND fecha_medicion >= NOW() - INTERVAL '7 days'`,
      [userId]
    );

    // 3. Resumen nutricional de hoy
    const nutricionHoy = await query(
      `SELECT
        COALESCE(SUM(calorias_total), 0) AS calorias,
        COALESCE(SUM(carbohidratos_total_g), 0) AS carbohidratos_g,
        COALESCE(SUM(proteinas_total_g), 0) AS proteinas_g,
        COALESCE(SUM(grasas_total_g), 0) AS grasas_g,
        COALESCE(SUM(fibra_total_g), 0) AS fibra_g,
        COUNT(*) AS comidas
       FROM registro_comidas
       WHERE usuario_id = $1
         AND DATE(fecha_comida) = CURRENT_DATE`,
      [userId]
    );

    // 4. Objetivos del paciente
    const objetivos = await query(
      `SELECT calorias_diarias_max, carbohidratos_max_g,
              glucosa_objetivo_min, glucosa_objetivo_max
       FROM objetivos_nutricionales
       WHERE usuario_id = $1`,
      [userId]
    );

    // 5. Total de conversaciones/consultas
    const totalConversaciones = await query(
      `SELECT COUNT(*) AS total FROM conversaciones WHERE usuario_id = $1`,
      [userId]
    );

    // 6. Última recomendación
    const ultimaRecomendacion = await query(
      `SELECT titulo, tipo, calorias_totales, carbohidratos_totales_g,
              indice_glucemico_estimado, fecha_creacion
       FROM recomendaciones
       WHERE usuario_id = $1
       ORDER BY fecha_creacion DESC LIMIT 1`,
      [userId]
    );

    // 7. Tendencia de glucosa últimos 7 días
    const tendencia7d = await query(
      `SELECT DATE(fecha_medicion) AS fecha,
              ROUND(AVG(valor_mg_dl)::numeric, 1) AS promedio
       FROM registros_glucosa
       WHERE usuario_id = $1
         AND fecha_medicion >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(fecha_medicion)
       ORDER BY fecha ASC`,
      [userId]
    );

    res.json({
      glucosa: {
        ultima: ultimaGlucosa.rows[0] || null,
        promedio7d: promedioGlucosa7d.rows[0],
        tendencia: tendencia7d.rows
      },
      nutricion: {
        hoy: nutricionHoy.rows[0],
        objetivos: objetivos.rows[0] || null
      },
      actividad: {
        totalConsultas: parseInt(totalConversaciones.rows[0].total),
        ultimaRecomendacion: ultimaRecomendacion.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Error en dashboard:', error.message);
    res.status(500).json({ error: 'Error al cargar dashboard' });
  }
};

/**
 * GET /api/dashboard/metricas
 * Métricas del sistema RAG (para tesis)
 */
const getMetricasSistema = async (req, res) => {
  try {
    const result = await query(
      `SELECT tipo_metrica,
              COUNT(*) AS total_mediciones,
              ROUND(AVG(valor)::numeric, 4) AS promedio,
              ROUND(MIN(valor)::numeric, 4) AS minimo,
              ROUND(MAX(valor)::numeric, 4) AS maximo,
              ROUND(STDDEV(valor)::numeric, 4) AS desviacion,
              modelo_llm
       FROM metricas_sistema
       GROUP BY tipo_metrica, modelo_llm
       ORDER BY tipo_metrica`
    );

    // Tiempos de respuesta promedio
    const tiempos = await query(
      `SELECT
        ROUND(AVG(tiempo_respuesta_ms)::numeric, 0) AS promedio_ms,
        ROUND(MIN(tiempo_respuesta_ms)::numeric, 0) AS min_ms,
        ROUND(MAX(tiempo_respuesta_ms)::numeric, 0) AS max_ms
       FROM mensajes
       WHERE rol = 'ASSISTANT' AND tiempo_respuesta_ms IS NOT NULL`
    );

    // Feedback promedio
    const feedback = await query(
      `SELECT
        ROUND(AVG(calificacion)::numeric, 2) AS calificacion_promedio,
        ROUND(AVG(relevancia)::numeric, 2) AS relevancia_promedio,
        ROUND(AVG(utilidad)::numeric, 2) AS utilidad_promedio,
        ROUND(AVG(confianza)::numeric, 2) AS confianza_promedio,
        ROUND(AVG(sus_score)::numeric, 2) AS sus_promedio,
        COUNT(*) AS total_evaluaciones
       FROM feedback_usuario`
    );

    res.json({
      metricas_rag: result.rows,
      tiempos_respuesta: tiempos.rows[0],
      feedback: feedback.rows[0]
    });
  } catch (error) {
    console.error('Error en métricas:', error.message);
    res.status(500).json({ error: 'Error al obtener métricas' });
  }
};

/**
 * POST /api/dashboard/feedback
 * Registrar feedback del usuario
 */
const registrarFeedback = async (req, res) => {
  try {
    const {
      recomendacion_id, mensaje_id,
      calificacion, relevancia, claridad, utilidad, confianza,
      comentario, sus_respuestas
    } = req.body;

    if (!calificacion || calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ error: 'Calificación requerida (1-5)' });
    }

    // Calcular SUS score si hay respuestas
    let susScore = null;
    if (sus_respuestas && Array.isArray(sus_respuestas) && sus_respuestas.length === 10) {
      // Fórmula SUS: (suma de items impares - 5) + (25 - suma de items pares) * 2.5
      const impares = sus_respuestas.filter((_, i) => i % 2 === 0).reduce((a, b) => a + (b - 1), 0);
      const pares = sus_respuestas.filter((_, i) => i % 2 === 1).reduce((a, b) => a + (5 - b), 0);
      susScore = (impares + pares) * 2.5;
    }

    const result = await query(
      `INSERT INTO feedback_usuario (
        usuario_id, recomendacion_id, mensaje_id,
        calificacion, relevancia, claridad, utilidad, confianza,
        comentario, sus_respuestas, sus_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        req.user.id, recomendacion_id, mensaje_id,
        calificacion, relevancia, claridad, utilidad, confianza,
        comentario, sus_respuestas ? JSON.stringify(sus_respuestas) : null,
        susScore
      ]
    );

    res.status(201).json({
      message: 'Feedback registrado. ¡Gracias!',
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar feedback:', error.message);
    res.status(500).json({ error: 'Error al registrar feedback' });
  }
};

module.exports = { getDashboard, getMetricasSistema, registrarFeedback };
