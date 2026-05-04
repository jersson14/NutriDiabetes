// ============================================
// Routes: Alimentos
// ============================================
const express = require('express');
const router = express.Router();
const {
  getAlimentos, getAlimentoById, getCategorias,
  getRecomendadosDM2, createAlimento, updateAlimento
} = require('../controllers/alimentosController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Públicas (para consulta general)
router.get('/', getAlimentos);
router.get('/categorias', getCategorias);
router.get('/recomendados', getRecomendadosDM2);
router.get('/:id', getAlimentoById);

// Protegidas (admin/nutricionista)
router.post('/', authMiddleware, requireRole('ADMINISTRADOR', 'NUTRICIONISTA'), createAlimento);
router.put('/:id', authMiddleware, requireRole('ADMINISTRADOR', 'NUTRICIONISTA'), updateAlimento);

module.exports = router;
