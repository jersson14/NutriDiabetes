const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { registrarComida, getComidasHoy, eliminarComida } = require('../controllers/comidasController');

router.post('/',     authMiddleware, registrarComida);
router.get('/',      authMiddleware, getComidasHoy);
router.delete('/:id', authMiddleware, eliminarComida);

module.exports = router;
