'use strict';

require('dotenv').config();
const http    = require('http');
const { Server } = require('socket.io');

const app     = require('./src/app');
const { PORT } = require('./src/config/env');
const { ORIGENES_PERMITIDOS } = require('./src/config/cors');
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
  
  // Sincronización inicial al arrancar. La de eventos se omite si hubo una en
  // las últimas 6 h (cada reinicio de nodemon gastaría la cuota gratuita).
  const deportesService = require('./src/services/deportes.service');
  const bcvService      = require('./src/services/bcv.service');
  const { redis }       = require('./src/config/redis');
  setTimeout(async () => {
    try {
      console.log('[server] → Sincronizando BCV inicial...');
      const bcv = await bcvService.actualizarTasaDesdeApi();
      console.log(`[server] BCV: ${bcv.exito ? bcv.valor + ' Bs/$' + (bcv.omitida ? ' (manual del día)' : '') : 'falló – ' + bcv.motivo + ' · ' + bcv.error}`);
      if (bcv.exito && !bcv.omitida) io.emitirTodos('bcv_actualizada', { valor: bcv.valor, fuente: 'api' });

      const reciente = await redis.set('sync:deportes:arranque', '1', 'EX', 6 * 3600, 'NX');
      if (reciente !== 'OK' && process.env.SYNC_AL_ARRANCAR !== 'true') {
        console.log('[server] Sync de eventos omitida (hubo una en las últimas 6 h). SYNC_AL_ARRANCAR=true para forzarla.');
        return;
      }
      console.log('[server] → Sincronizando eventos iniciales...');
      const r = await deportesService.sincronizarEventosSemana();
      console.log(`[server] Eventos: ${r.creados} creados | ${r.actualizados} actualizados | ${r.errores.length} errores`);
      if (r.errores.length) console.warn('[server] Errores:', r.errores.slice(0, 5));
    } catch (err) {
      console.error('[server] Sincronización inicial falló:', err.message);
    }
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