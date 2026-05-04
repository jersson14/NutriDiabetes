// ============================================
// Controller: Alimentos
// ============================================
const { query } = require('../config/database');

/**
 * GET /api/alimentos
 * Listar alimentos con filtros y paginación
 */
const getAlimentos = async (req, res) => {
  try {
    const {
      search,         // Búsqueda por nombre
      categoria,      // Filtrar por categoría
      recomendacion,  // RECOMENDADO, MODERADO, LIMITAR
      igMax,          // IG máximo
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['a.activo = TRUE'];
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(
        `(LOWER(a.nombre) LIKE $${paramIndex} OR LOWER(a.nombre_comun) LIKE $${paramIndex})`
      );
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    if (categoria) {
      whereConditions.push(`a.categoria_id = $${paramIndex}`);
      params.push(parseInt(categoria));
      paramIndex++;
    }

    if (recomendacion) {
      whereConditions.push(`a.nivel_recomendacion = $${paramIndex}`);
      params.push(recomendacion);
      paramIndex++;
    }

    if (igMax) {
      whereConditions.push(`(a.indice_glucemico <= $${paramIndex} OR a.indice_glucemico IS NULL)`);
      params.push(parseInt(igMax));
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Total count
    const countResult = await query(
      `SELECT COUNT(*) FROM alimentos a ${whereClause}`,
      params
    );

    // Data
    const result = await query(
      `SELECT a.id, a.codigo_tpca, a.nombre, a.nombre_comun,
              ca.nombre AS categoria, ca.icono,
              a.energia_kcal, a.proteinas_g, a.grasas_totales_g,
              a.carbohidratos_totales_g, a.carbohidratos_disponibles_g,
              a.fibra_dietaria_g, a.indice_glucemico, a.carga_glucemica,
              a.nivel_recomendacion, a.es_apto_diabeticos,
              a.calcio_mg, a.hierro_mg, a.vitamina_c_mg,
              a.costo_aproximado, a.origen_region
       FROM alimentos a
       JOIN categorias_alimentos ca ON a.categoria_id = ca.id
       ${whereClause}
       ORDER BY a.nombre ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), offset]
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error al listar alimentos:', error.message);
    res.status(500).json({ error: 'Error al obtener alimentos' });
  }
};

/**
 * GET /api/alimentos/:id
 * Obtener detalle de un alimento
 */
const getAlimentoById = async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, ca.nombre AS categoria_nombre, ca.icono
       FROM alimentos a
       JOIN categorias_alimentos ca ON a.categoria_id = ca.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alimento no encontrado' });
    }

    // Obtener referencias de IG
    const igRefs = await query(
      `SELECT valor_ig, clasificacion, fuente FROM indice_glucemico_referencia
       WHERE alimento_id = $1`,
      [req.params.id]
    );

    res.json({
      alimento: result.rows[0],
      referencias_ig: igRefs.rows
    });
  } catch (error) {
    console.error('Error al obtener alimento:', error.message);
    res.status(500).json({ error: 'Error al obtener alimento' });
  }
};

/**
 * GET /api/alimentos/categorias
 * Listar categorías
 */
const getCategorias = async (req, res) => {
  try {
    const result = await query(
      `SELECT ca.id, ca.codigo, ca.nombre, ca.icono,
              COUNT(a.id) AS total_alimentos
       FROM categorias_alimentos ca
       LEFT JOIN alimentos a ON ca.id = a.categoria_id AND a.activo = TRUE
       WHERE ca.activo = TRUE
       GROUP BY ca.id
       ORDER BY ca.orden`
    );

    res.json({ categorias: result.rows });
  } catch (error) {
    console.error('Error al listar categorías:', error.message);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

/**
 * GET /api/alimentos/recomendados
 * Alimentos recomendados para DM2 (IG bajo, alta fibra)
 */
const getRecomendadosDM2 = async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.nombre, a.nombre_comun,
              ca.nombre AS categoria, ca.icono,
              a.energia_kcal, a.carbohidratos_disponibles_g,
              a.fibra_dietaria_g, a.proteinas_g,
              a.indice_glucemico, a.carga_glucemica,
              a.nivel_recomendacion, a.costo_aproximado
       FROM alimentos a
       JOIN categorias_alimentos ca ON a.categoria_id = ca.id
       WHERE a.activo = TRUE
         AND a.es_apto_diabeticos = TRUE
         AND a.nivel_recomendacion = 'RECOMENDADO'
       ORDER BY a.indice_glucemico ASC NULLS LAST,
                a.fibra_dietaria_g DESC NULLS LAST
       LIMIT 50`
    );

    res.json({ alimentos: result.rows });
  } catch (error) {
    console.error('Error al obtener recomendados:', error.message);
    res.status(500).json({ error: 'Error al obtener alimentos recomendados' });
  }
};

/**
 * POST /api/alimentos
 * Crear alimento (admin/nutricionista)
 */
const createAlimento = async (req, res) => {
  try {
    const {
      codigo_tpca, nombre, nombre_comun, nombre_cientifico,
      categoria_id, energia_kcal, agua_g, proteinas_g,
      grasas_totales_g, carbohidratos_totales_g,
      carbohidratos_disponibles_g, fibra_dietaria_g,
      cenizas_g, calcio_mg, fosforo_mg, hierro_mg,
      zinc_mg, sodio_mg, potasio_mg, vitamina_c_mg,
      indice_glucemico, carga_glucemica,
      costo_aproximado, origen_region
    } = req.body;

    if (!nombre || !categoria_id) {
      return res.status(400).json({
        error: 'Nombre y categoría son requeridos'
      });
    }

    const result = await query(
      `INSERT INTO alimentos (
        codigo_tpca, nombre, nombre_comun, nombre_cientifico,
        categoria_id, energia_kcal, agua_g, proteinas_g,
        grasas_totales_g, carbohidratos_totales_g,
        carbohidratos_disponibles_g, fibra_dietaria_g,
        cenizas_g, calcio_mg, fosforo_mg, hierro_mg,
        zinc_mg, sodio_mg, potasio_mg, vitamina_c_mg,
        indice_glucemico, carga_glucemica,
        costo_aproximado, origen_region
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      ) RETURNING *`,
      [
        codigo_tpca, nombre, nombre_comun, nombre_cientifico,
        categoria_id, energia_kcal, agua_g, proteinas_g,
        grasas_totales_g, carbohidratos_totales_g,
        carbohidratos_disponibles_g, fibra_dietaria_g,
        cenizas_g, calcio_mg, fosforo_mg, hierro_mg,
        zinc_mg, sodio_mg, potasio_mg, vitamina_c_mg,
        indice_glucemico, carga_glucemica,
        costo_aproximado, origen_region
      ]
    );

    res.status(201).json({
      message: 'Alimento creado exitosamente',
      alimento: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear alimento:', error.message);
    res.status(500).json({ error: 'Error al crear alimento' });
  }
};

/**
 * PUT /api/alimentos/:id
 * Actualizar alimento
 */
const updateAlimento = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    // Construir query dinámico
    const keys = Object.keys(fields).filter(k => k !== 'id');
    if (keys.length === 0) {
      return res.status(400).json({ error: 'Sin campos para actualizar' });
    }

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = keys.map(k => fields[k]);
    values.push(id);

    const result = await query(
      `UPDATE alimentos SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alimento no encontrado' });
    }

    res.json({
      message: 'Alimento actualizado',
      alimento: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar alimento:', error.message);
    res.status(500).json({ error: 'Error al actualizar alimento' });
  }
};

module.exports = {
  getAlimentos,
  getAlimentoById,
  getCategorias,
  getRecomendadosDM2,
  createAlimento,
  updateAlimento
};
