// ============================================
// Routes: Dashboard / Analytics
// ============================================
const express = require('express');
const router = express.Router();
const {
  getDashboard, getMetricasSistema, registrarFeedback
} = require('../controllers/dashboardController');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getDashboard);
router.get('/metricas', requireRole('ADMINISTRADOR', 'NUTRICIONISTA'), getMetricasSistema);
router.post('/feedback', registrarFeedback);

module.exports = router;
