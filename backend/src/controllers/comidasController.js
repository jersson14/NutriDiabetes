// ============================================
// Controller: Registro de Comidas
// ============================================
const { query } = require('../config/database');

/**
 * POST /api/comidas
 * Registra una comida con los datos nutricionales calculados desde el alimento.
 */
const registrarComida = async (req, res) => {
  try {
    const {
      tipo_comida,
      alimento_id,
      nombre_alimento,
      cantidad_g,
      calorias_total,
      carbohidratos_total_g,
      proteinas_total_g,
      grasas_total_g,
      fibra_total_g,
      notas,
    } = req.body;

    if (!tipo_comida || !nombre_alimento || !cantidad_g) {
      return res.status(400).json({ error: 'tipo_comida, nombre_alimento y cantidad_g son requeridos' });
    }

    const TIPOS = ['DESAYUNO', 'MEDIA_MANANA', 'ALMUERZO', 'MEDIA_TARDE', 'CENA', 'SNACK'];
    if (!TIPOS.includes(tipo_comida)) {
      return res.status(400).json({ error: `tipo_comida debe ser uno de: ${TIPOS.join(', ')}` });
    }

    // Insertar registro de comida
    const comida = await query(
      `INSERT INTO registro_comidas (
        usuario_id, tipo_comida, fecha_comida,
        calorias_total, carbohidratos_total_g, proteinas_total_g,
        grasas_total_g, fibra_total_g, notas
      ) VALUES ($1,$2,NOW(),$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        req.user.id, tipo_comida,
        calorias_total || null,
        carbohidratos_total_g || null,
        proteinas_total_g || null,
        grasas_total_g || null,
        fibra_total_g || null,
        notas || null,
      ]
    );

    // Insertar detalle del alimento si se provee alimento_id o nombre
    await query(
      `INSERT INTO comida_alimentos (
        comida_id, alimento_id, nombre_alimento, cantidad_g,
        calorias, carbohidratos_g, proteinas_g, grasas_g
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        comida.rows[0].id,
        alimento_id || null,
        nombre_alimento,
        parseFloat(cantidad_g),
        calorias_total || null,
        carbohidratos_total_g || null,
        proteinas_total_g || null,
        grasas_total_g || null,
      ]
    );

    res.status(201).json({ comida: comida.rows[0] });
  } catch (error) {
    console.error('Error al registrar comida:', error.message);
    res.status(500).json({ error: 'Error al registrar la comida' });
  }
};

/**
 * GET /api/comidas
 * Devuelve las comidas registradas hoy por el usuario.
 */
const getComidasHoy = async (req, res) => {
  try {
    const result = await query(
      `SELECT
        rc.id, rc.tipo_comida, rc.fecha_comida, rc.notas,
        rc.calorias_total, rc.carbohidratos_total_g,
        rc.proteinas_total_g, rc.grasas_total_g, rc.fibra_total_g,
        json_agg(json_build_object(
          'nombre', ca.nombre_alimento,
          'cantidad_g', ca.cantidad_g,
          'calorias', ca.calorias
        )) AS alimentos
       FROM registro_comidas rc
       LEFT JOIN comida_alimentos ca ON ca.comida_id = rc.id
       WHERE rc.usuario_id = $1
         AND DATE(rc.fecha_comida) = CURRENT_DATE
       GROUP BY rc.id
       ORDER BY rc.fecha_comida ASC`,
      [req.user.id]
    );

    const totales = result.rows.reduce((acc, r) => ({
      calorias:       acc.calorias       + parseFloat(r.calorias_total       || 0),
      carbohidratos:  acc.carbohidratos  + parseFloat(r.carbohidratos_total_g || 0),
      proteinas:      acc.proteinas      + parseFloat(r.proteinas_total_g    || 0),
      grasas:         acc.grasas         + parseFloat(r.grasas_total_g       || 0),
      fibra:          acc.fibra          + parseFloat(r.fibra_total_g        || 0),
    }), { calorias: 0, carbohidratos: 0, proteinas: 0, grasas: 0, fibra: 0 });

    res.json({ comidas: result.rows, totales });
  } catch (error) {
    console.error('Error al obtener comidas:', error.message);
    res.status(500).json({ error: 'Error al obtener las comidas' });
  }
};

/**
 * DELETE /api/comidas/:id
 * Elimina una comida del diario de hoy.
 */
const eliminarComida = async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM registro_comidas
       WHERE id = $1 AND usuario_id = $2 AND DATE(fecha_comida) = CURRENT_DATE
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comida no encontrada o no puedes eliminarla' });
    }

    res.json({ mensaje: 'Comida eliminada' });
  } catch (error) {
    console.error('Error al eliminar comida:', error.message);
    res.status(500).json({ error: 'Error al eliminar la comida' });
  }
};

module.exports = { registrarComida, getComidasHoy, eliminarComida };
