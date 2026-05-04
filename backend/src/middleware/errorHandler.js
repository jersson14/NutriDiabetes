// ============================================
// Middleware de Manejo de Errores
// ============================================

/**
 * Handler para rutas no encontradas (404)
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND'
  });
};

/**
 * Handler global de errores
 */
const errorHandler = (err, req, res, next) => {
  console.error('🔴 Error:', err.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Errores de validación de PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'El registro ya existe (dato duplicado)',
      code: 'DUPLICATE_ENTRY',
      detail: err.detail
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Referencia inválida (el registro relacionado no existe)',
      code: 'FOREIGN_KEY_VIOLATION'
    });
  }

  if (err.code === '23514') {
    return res.status(400).json({
      error: 'Datos no válidos (no cumplen las restricciones)',
      code: 'CHECK_VIOLATION',
      detail: err.detail
    });
  }

  // Error genérico
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Error interno del servidor',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler, notFoundHandler };
