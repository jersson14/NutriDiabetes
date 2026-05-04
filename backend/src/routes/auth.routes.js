// ============================================
// Routes: Autenticación
// ============================================
const express = require('express');
const router = express.Router();
const { loginWithGoogle, register, login, getMe } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// Públicas
router.post('/google', loginWithGoogle);
router.post('/register', register);
router.post('/login', login);

// Protegidas
router.get('/me', authMiddleware, getMe);

module.exports = router;
