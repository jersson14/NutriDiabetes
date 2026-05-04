// ============================================
// Controller: Registros de Glucosa
// ============================================
const { query } = require('../config/database');

/**
 * POST /api/glucosa
 * Registrar medición de glucosa
 */
const registrarGlucosa = async (req, res) => {
  try {
    const { valor_mg_dl, tipo_medicion, notas } = req.body;

    if (!valor_mg_dl || !tipo_medicion) {
      return res.status(400).json({
        error: 'Valor de glucosa y tipo de medición son requeridos'
      });
    }

    const result = await query(
      `INSERT INTO registros_glucosa (usuario_id, valor_mg_dl, tipo_medicion, notas)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, valor_mg_dl, tipo_medicion, notas]
    );

    res.status(201).json({
      message: 'Medición registrada',
      registro: result.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar glucosa:', error.message);
    res.status(500).json({ error: 'Error al registrar medición' });
  }
};

/**
 * GET /api/glucosa
 * Obtener historial de glucosa
 */
const getHistorialGlucosa = async (req, res) => {
  try {
    const { dias = 30, tipo } = req.query;
    let params = [req.user.id, parseInt(dias)];
    let whereExtra = '';

    if (tipo) {
      whereExtra = ' AND tipo_medicion = $3';
      params.push(tipo);
    }

    const result = await query(
      `SELECT id, valor_mg_dl, tipo_medicion, esta_en_rango,
              notas, fecha_medicion
       FROM registros_glucosa
       WHERE usuario_id = $1
         AND fecha_medicion >= NOW() - INTERVAL '1 day' * $2
         ${whereExtra}
       ORDER BY fecha_medicion DESC`,
      params
    );

    // Calcular promedios
    const stats = await query(
      `SELECT
        ROUND(AVG(valor_mg_dl)::numeric, 1) AS promedio,
        ROUND(MIN(valor_mg_dl)::numeric, 1) AS minimo,
        ROUND(MAX(valor_mg_dl)::numeric, 1) AS maximo,
        COUNT(*) AS total_mediciones,
        COUNT(*) FILTER (WHERE esta_en_rango = TRUE) AS en_rango,
        COUNT(*) FILTER (WHERE esta_en_rango = FALSE) AS fuera_rango
       FROM registros_glucosa
       WHERE usuario_id = $1
         AND fecha_medicion >= NOW() - INTERVAL '1 day' * $2`,
      [req.user.id, parseInt(dias)]
    );

    res.json({
      registros: result.rows,
      estadisticas: stats.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener glucosa:', error.message);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

/**
 * GET /api/glucosa/tendencia
 * Obtener tendencia de glucosa (para gráficos)
 */
const getTendenciaGlucosa = async (req, res) => {
  try {
    const { dias = 30 } = req.query;

    const result = await query(
      `SELECT
        DATE(fecha_medicion) AS fecha,
        ROUND(AVG(valor_mg_dl)::numeric, 1) AS promedio_dia,
        ROUND(MIN(valor_mg_dl)::numeric, 1) AS min_dia,
        ROUND(MAX(valor_mg_dl)::numeric, 1) AS max_dia,
        COUNT(*) AS mediciones
       FROM registros_glucosa
       WHERE usuario_id = $1
         AND fecha_medicion >= NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(fecha_medicion)
       ORDER BY fecha ASC`,
      [req.user.id, parseInt(dias)]
    );

    res.json({ tendencia: result.rows });
  } catch (error) {
    console.error('Error al obtener tendencia:', error.message);
    res.status(500).json({ error: 'Error al obtener tendencia' });
  }
};

module.exports = { registrarGlucosa, getHistorialGlucosa, getTendenciaGlucosa };
