'use strict';

require('dotenv').config();
const http    = require('http');
const { Server } = require('socket.io');

const app     = require('./src/app');
const { PORT } = require('./src/config/env');
const { testConnection: testDb }    = require('./src/config/db');
const { testConnection: testRedis } = require('./src/config/redis');
const iniciarSocket  = require('./src/socket/socket.handler');
const bcvJob         = require('./src/jobs/bcv.job');
const deportesJob    = require('./src/jobs/deportes.job');
const caducidadJob   = require('./src/jobs/caducidad.job');

async function arrancar() {
  // Verificar conexiones
  await testDb();
  await testRedis();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Registrar socket handler
  iniciarSocket(io);

  // Disponibilizar io en app para controllers/routes
  app.set('io', io);

  // Arrancar cron jobs
  bcvJob.iniciar(io);
  deportesJob.iniciar(io);
  caducidadJob.iniciar(io);

  server.listen(PORT, () => {
    console.log(`[server] TuParley backend corriendo en puerto ${PORT}`);
    console.log(`[server] Entorno: ${process.env.NODE_ENV ?? 'development'}`);
  });

  // Apagado limpio
  process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
  process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
}

arrancar().catch(err => {
  console.error('[server] Error al arrancar:', err);
  process.exit(1);
});