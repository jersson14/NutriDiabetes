// ============================================
// Server Entry Point
// ============================================
const app = require('./app');
const { pool } = require('./config/database');

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    // Verificar conexión a la base de datos
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('🗄️  PostgreSQL conectado:', result.rows[0].now);
    client.release();

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('');
      console.log('🍎 ═══════════════════════════════════════');
      console.log('   NutriDiabetes Perú - API Backend');
      console.log('   Diabetes Mellitus Tipo 2');
      console.log('🍎 ═══════════════════════════════════════');
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
      console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log('═══════════════════════════════════════════');
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Interrupción recibida. Cerrando...');
  await pool.end();
  process.exit(0);
});

startServer();
