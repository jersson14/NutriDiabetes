// ============================================
// Routes: Chat / Conversaciones RAG
// ============================================
const express = require('express');
const router = express.Router();
const {
  sendMessage, getConversaciones,
  getConversacion, deleteConversacion
} = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/auth');

// Todas protegidas
router.use(authMiddleware);

router.post('/message', sendMessage);
router.get('/conversaciones', getConversaciones);
router.get('/conversacion/:id', getConversacion);
router.delete('/conversacion/:id', deleteConversacion);

module.exports = router;
