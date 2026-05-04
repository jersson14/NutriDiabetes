// ============================================
// Controller: Autenticación
// ============================================
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const { generateTokens } = require('../middleware/auth');
const axios = require('axios');

/**
 * POST /api/auth/google
 * Login/Registro con Google OAuth
 */
const loginWithGoogle = async (req, res) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({ error: 'Token de Google requerido' });
    }

    // Verificar token con Google
    const googleResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    );

    const { sub: googleId, email, name, picture } = googleResponse.data;

    // Buscar o crear usuario
    let result = await query(
      'SELECT * FROM usuarios WHERE google_id = $1 OR email = $2',
      [googleId, email]
    );

    let user;

    if (result.rows.length === 0) {
      // Crear nuevo usuario
      const insertResult = await transaction(async (client) => {
        const userResult = await client.query(
          `INSERT INTO usuarios (email, nombre_completo, google_id, avatar_url, rol)
           VALUES ($1, $2, $3, $4, 'PACIENTE')
           RETURNING *`,
          [email, name, googleId, picture]
        );

        const userId = userResult.rows[0].id;

        // Crear perfil de salud vacío
        await client.query(
          `INSERT INTO perfiles_salud (usuario_id) VALUES ($1)`,
          [userId]
        );

        // Crear objetivos nutricionales por defecto (ADA guidelines para DM2)
        await client.query(
          `INSERT INTO objetivos_nutricionales (usuario_id, definido_por)
           VALUES ($1, 'SISTEMA')`,
          [userId]
        );

        return userResult;
      });

      user = insertResult.rows[0];
    } else {
      user = result.rows[0];
      // Actualizar datos de Google
      await query(
        `UPDATE usuarios SET google_id = $1, avatar_url = $2, ultimo_acceso = NOW()
         WHERE id = $3`,
        [googleId, picture, user.id]
      );
    }

    // Generar JWT
    const tokens = generateTokens(user.id);

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre_completo,
        avatar: user.avatar_url,
        rol: user.rol
      },
      ...tokens
    });
  } catch (error) {
    console.error('Error en login Google:', error.message);
    res.status(500).json({ error: 'Error en autenticación con Google' });
  }
};

/**
 * POST /api/auth/register
 * Registro con email/password (alternativa a Google)
 */
const register = async (req, res) => {
  try {
    const { email, password, nombreCompleto } = req.body;

    if (!email || !password || !nombreCompleto) {
      return res.status(400).json({
        error: 'Email, contraseña y nombre completo son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar si ya existe
    const exists = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await transaction(async (client) => {
      const userResult = await client.query(
        `INSERT INTO usuarios (email, nombre_completo, rol)
         VALUES ($1, $2, 'PACIENTE')
         RETURNING *`,
        [email, nombreCompleto]
      );

      const userId = userResult.rows[0].id;

      // Guardar hash en sesiones (como password temporal)
      await client.query(
        `INSERT INTO sesiones (usuario_id, token_hash, expira_en)
         VALUES ($1, $2, NOW() + INTERVAL '365 days')`,
        [userId, passwordHash]
      );

      // Crear perfil de salud vacío
      await client.query(
        `INSERT INTO perfiles_salud (usuario_id) VALUES ($1)`,
        [userId]
      );

      // Crear objetivos nutricionales por defecto
      await client.query(
        `INSERT INTO objetivos_nutricionales (usuario_id, definido_por)
         VALUES ($1, 'SISTEMA')`,
        [userId]
      );

      return userResult;
    });

    const user = result.rows[0];
    const tokens = generateTokens(user.id);

    res.status(201).json({
      message: 'Registro exitoso',
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre_completo,
        rol: user.rol
      },
      ...tokens
    });
  } catch (error) {
    console.error('Error en registro:', error.message);
    res.status(500).json({ error: 'Error en registro' });
  }
};

/**
 * POST /api/auth/login
 * Login con email/password
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Buscar usuario
    const userResult = await query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = userResult.rows[0];

    // Buscar hash de contraseña
    const sessionResult = await query(
      'SELECT token_hash FROM sesiones WHERE usuario_id = $1 ORDER BY fecha_creacion DESC LIMIT 1',
      [user.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValid = await bcrypt.compare(password, sessionResult.rows[0].token_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Actualizar último acceso
    await query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [user.id]);

    const tokens = generateTokens(user.id);

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre_completo,
        avatar: user.avatar_url,
        rol: user.rol
      },
      ...tokens
    });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error en autenticación' });
  }
};

/**
 * GET /api/auth/me
 * Obtener usuario actual
 */
const getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.nombre_completo, u.avatar_url, u.rol,
              ps.clasificacion_dm2, ps.hemoglobina_glicosilada,
              ps.peso_kg, ps.talla_cm, ps.imc
       FROM usuarios u
       LEFT JOIN perfiles_salud ps ON u.id = ps.usuario_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener usuario:', error.message);
    res.status(500).json({ error: 'Error al obtener datos del usuario' });
  }
};

module.exports = { loginWithGoogle, register, login, getMe };
