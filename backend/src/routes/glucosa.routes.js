// ============================================
// Routes: Glucosa
// ============================================
const express = require('express');
const router = express.Router();
const {
  registrarGlucosa, getHistorialGlucosa, getTendenciaGlucosa
} = require('../controllers/glucosaController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', registrarGlucosa);
router.get('/', getHistorialGlucosa);
router.get('/tendencia', getTendenciaGlucosa);

module.exports = router;
