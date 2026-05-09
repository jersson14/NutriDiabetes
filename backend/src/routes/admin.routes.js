const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  getStats, getUsuarios, getMetricasRAG,
  getConsultas, getLogs, toggleUsuarioActivo,
  getAlimentosAdmin, crearAlimento, eliminarAlimento,
} = require('../controllers/adminController');

const adminOnly = [authMiddleware, requireRole('ADMINISTRADOR')];

router.get('/stats',              ...adminOnly, getStats);
router.get('/usuarios',           ...adminOnly, getUsuarios);
router.get('/metricas-rag',       ...adminOnly, getMetricasRAG);
router.get('/consultas',          ...adminOnly, getConsultas);
router.get('/logs',               ...adminOnly, getLogs);
router.put('/usuarios/:id/activo',...adminOnly, toggleUsuarioActivo);
router.get('/alimentos',          ...adminOnly, getAlimentosAdmin);
router.post('/alimentos',         ...adminOnly, crearAlimento);
router.delete('/alimentos/:id',   ...adminOnly, eliminarAlimento);

module.exports = router;
