// ============================================
// Routes: Perfil de Salud
// ============================================
const express = require('express');
const router = express.Router();
const { getPerfil, updatePerfilSalud, updateObjetivos } = require('../controllers/perfilController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getPerfil);
router.put('/salud', updatePerfilSalud);
router.put('/objetivos', updateObjetivos);

module.exports = router;
