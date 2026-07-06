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
  await testDb();
  await testRedis();

  const server = http.createServer(app);

  const ORIGENES_PERMITIDOS = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: ORIGENES_PERMITIDOS,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  iniciarSocket(io);
  app.set('io', io);

  bcvJob.iniciar(io);
  deportesJob.iniciar(io);
  caducidadJob.iniciar(io);
  
  // Sincronización inicial al arrancar
  const deportesService = require('./src/services/deportes.service');
  const bcvService      = require('./src/services/bcv.service');
  setTimeout(async () => {
    console.log('[server] → Sincronizando BCV inicial...');
    const bcv = await bcvService.actualizarTasaDesdeApi();
    console.log(`[server] BCV: ${bcv.exito ? bcv.valor + ' Bs/$' : 'falló – ' + bcv.motivo}`);

    console.log('[server] → Sincronizando eventos iniciales...');
    const r = await deportesService.sincronizarEventosSemana();
    console.log(`[server] Eventos: ${r.creados} creados | ${r.actualizados} actualizados | ${r.errores.length} errores`);
    if (r.errores.length) console.warn('[server] Errores:', r.errores);
}, 2000);

  server.listen(PORT, () => {
    console.log(`[server] TuParley backend corriendo en puerto ${PORT}`);
    console.log(`[server] Entorno: ${process.env.NODE_ENV ?? 'development'}`);
  });

  process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
  process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
}

arrancar().catch(err => {
  console.error('[server] Error al arrancar:', err);
  process.exit(1);
});