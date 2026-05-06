// ============================================
// Routes: Chat / Conversaciones RAG
// ============================================
const express = require('express');
const router = express.Router();
const {
  sendMessage, getConversaciones,
  getConversacion, deleteConversacion,
  warmupService
} = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/auth');

// Ruta pública para pre-calentar el AI Service (sin auth)
router.get('/warmup', warmupService);

// Rutas protegidas
router.use(authMiddleware);

router.post('/message', sendMessage);
router.get('/conversaciones', getConversaciones);
router.get('/conversacion/:id', getConversacion);
router.delete('/conversacion/:id', deleteConversacion);

module.exports = router;
