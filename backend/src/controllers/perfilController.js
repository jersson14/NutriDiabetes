// ============================================
// Controller: Perfil de Salud
// ============================================
const { query } = require('../config/database');

/**
 * GET /api/perfil
 * Obtener perfil completo del paciente
 */
const getPerfil = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.nombre_completo, u.avatar_url, u.rol,
              ps.*,
              on2.calorias_diarias_min, on2.calorias_diarias_max,
              on2.carbohidratos_max_g, on2.proteinas_min_g,
              on2.grasas_max_g, on2.fibra_min_g,
              on2.carbohidratos_por_comida_max_g,
              on2.glucosa_objetivo_min, on2.glucosa_objetivo_max,
              on2.glucosa_postprandial_max
       FROM usuarios u
       LEFT JOIN perfiles_salud ps ON u.id = ps.usuario_id
       LEFT JOIN objetivos_nutricionales on2 ON u.id = on2.usuario_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json({ perfil: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener perfil:', error.message);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

/**
 * PUT /api/perfil/salud
 * Actualizar perfil de salud (datos clínicos DM2)
 */
const updatePerfilSalud = async (req, res) => {
  try {
    const {
      fecha_nacimiento, sexo, peso_kg, talla_cm,
      circunferencia_cintura_cm,
      clasificacion_dm2, anio_diagnostico,
      hemoglobina_glicosilada, glucosa_ayunas_promedio,
      glucosa_postprandial_promedio,
      usa_insulina, usa_metformina, usa_sulfonilureas,
      usa_inhibidores_dpp4, otros_medicamentos, dosis_medicamentos,
      tiene_hipertension, tiene_dislipidemia,
      tiene_nefropatia, tiene_retinopatia, tiene_neuropatia,
      nivel_actividad, horas_suenio_promedio, fuma, consume_alcohol,
      alergias, intolerancias, restricciones_dieteticas,
      departamento, provincia
    } = req.body;

    const result = await query(
      `UPDATE perfiles_salud SET
        fecha_nacimiento = COALESCE($2, fecha_nacimiento),
        sexo = COALESCE($3, sexo),
        peso_kg = COALESCE($4, peso_kg),
        talla_cm = COALESCE($5, talla_cm),
        circunferencia_cintura_cm = COALESCE($6, circunferencia_cintura_cm),
        clasificacion_dm2 = COALESCE($7, clasificacion_dm2),
        anio_diagnostico = COALESCE($8, anio_diagnostico),
        hemoglobina_glicosilada = COALESCE($9, hemoglobina_glicosilada),
        glucosa_ayunas_promedio = COALESCE($10, glucosa_ayunas_promedio),
        glucosa_postprandial_promedio = COALESCE($11, glucosa_postprandial_promedio),
        usa_insulina = COALESCE($12, usa_insulina),
        usa_metformina = COALESCE($13, usa_metformina),
        usa_sulfonilureas = COALESCE($14, usa_sulfonilureas),
        usa_inhibidores_dpp4 = COALESCE($15, usa_inhibidores_dpp4),
        otros_medicamentos = COALESCE($16, otros_medicamentos),
        dosis_medicamentos = COALESCE($17, dosis_medicamentos),
        tiene_hipertension = COALESCE($18, tiene_hipertension),
        tiene_dislipidemia = COALESCE($19, tiene_dislipidemia),
        tiene_nefropatia = COALESCE($20, tiene_nefropatia),
        tiene_retinopatia = COALESCE($21, tiene_retinopatia),
        tiene_neuropatia = COALESCE($22, tiene_neuropatia),
        nivel_actividad = COALESCE($23, nivel_actividad),
        horas_suenio_promedio = COALESCE($24, horas_suenio_promedio),
        fuma = COALESCE($25, fuma),
        consume_alcohol = COALESCE($26, consume_alcohol),
        alergias = COALESCE($27, alergias),
        intolerancias = COALESCE($28, intolerancias),
        restricciones_dieteticas = COALESCE($29, restricciones_dieteticas),
        departamento = COALESCE($30, departamento),
        provincia = COALESCE($31, provincia)
       WHERE usuario_id = $1
       RETURNING *`,
      [
        req.user.id,
        fecha_nacimiento, sexo, peso_kg, talla_cm,
        circunferencia_cintura_cm,
        clasificacion_dm2, anio_diagnostico,
        hemoglobina_glicosilada, glucosa_ayunas_promedio,
        glucosa_postprandial_promedio,
        usa_insulina, usa_metformina, usa_sulfonilureas,
        usa_inhibidores_dpp4, otros_medicamentos,
        dosis_medicamentos ? JSON.stringify(dosis_medicamentos) : null,
        tiene_hipertension, tiene_dislipidemia,
        tiene_nefropatia, tiene_retinopatia, tiene_neuropatia,
        nivel_actividad, horas_suenio_promedio, fuma, consume_alcohol,
        alergias, intolerancias, restricciones_dieteticas,
        departamento, provincia
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json({
      message: 'Perfil de salud actualizado',
      perfil: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error.message);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

/**
 * PUT /api/perfil/objetivos
 * Actualizar objetivos nutricionales
 */
const updateObjetivos = async (req, res) => {
  try {
    const {
      calorias_diarias_min, calorias_diarias_max,
      carbohidratos_max_g, proteinas_min_g,
      grasas_max_g, fibra_min_g,
      carbohidratos_por_comida_max_g, sodio_max_mg,
      glucosa_objetivo_min, glucosa_objetivo_max,
      glucosa_postprandial_max
    } = req.body;

    const result = await query(
      `UPDATE objetivos_nutricionales SET
        calorias_diarias_min = COALESCE($2, calorias_diarias_min),
        calorias_diarias_max = COALESCE($3, calorias_diarias_max),
        carbohidratos_max_g = COALESCE($4, carbohidratos_max_g),
        proteinas_min_g = COALESCE($5, proteinas_min_g),
        grasas_max_g = COALESCE($6, grasas_max_g),
        fibra_min_g = COALESCE($7, fibra_min_g),
        carbohidratos_por_comida_max_g = COALESCE($8, carbohidratos_por_comida_max_g),
        sodio_max_mg = COALESCE($9, sodio_max_mg),
        glucosa_objetivo_min = COALESCE($10, glucosa_objetivo_min),
        glucosa_objetivo_max = COALESCE($11, glucosa_objetivo_max),
        glucosa_postprandial_max = COALESCE($12, glucosa_postprandial_max),
        definido_por = 'PACIENTE'
       WHERE usuario_id = $1
       RETURNING *`,
      [
        req.user.id,
        calorias_diarias_min, calorias_diarias_max,
        carbohidratos_max_g, proteinas_min_g,
        grasas_max_g, fibra_min_g,
        carbohidratos_por_comida_max_g, sodio_max_mg,
        glucosa_objetivo_min, glucosa_objetivo_max,
        glucosa_postprandial_max
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Objetivos no encontrados' });
    }

    res.json({
      message: 'Objetivos nutricionales actualizados',
      objetivos: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar objetivos:', error.message);
    res.status(500).json({ error: 'Error al actualizar objetivos' });
  }
};

module.exports = { getPerfil, updatePerfilSalud, updateObjetivos };
