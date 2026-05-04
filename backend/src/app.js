// ============================================
// Express App Configuration
// ============================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ── Security ──
app.use(helmet());

// ── CORS ──
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    error: 'Demasiadas solicitudes. Intente de nuevo más tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});
app.use('/api/', limiter);

// ── Body Parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ──
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Routes ──
const authRoutes = require('./routes/auth.routes');
const alimentosRoutes = require('./routes/alimentos.routes');
const chatRoutes = require('./routes/chat.routes');
const glucosaRoutes = require('./routes/glucosa.routes');
const perfilRoutes = require('./routes/perfil.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

app.use('/api/auth', authRoutes);
app.use('/api/alimentos', alimentosRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/glucosa', glucosaRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NutriDiabetes API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── Error Handler ──
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
