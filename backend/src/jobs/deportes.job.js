'use strict';
const cron           = require('node-cron');
const deportesService = require('../services/deportes.service');

function iniciar(io) {
  // Sincronizar eventos de la semana → cada hora
  cron.schedule('0 * * * *', async () => {
    console.log('[deportes.job] Sincronizando eventos...');
    const r = await deportesService.sincronizarEventosSemana();
    console.log(`[deportes.job] Creados: ${r.creados} | Actualizados: ${r.actualizados} | Errores: ${r.errores.length}`);
    if (r.errores.length) console.warn('[deportes.job] Errores:', r.errores);
  }, { timezone: 'America/Caracas' });

  // Cerrar apuestas de eventos iniciados → cada 2 minutos
  cron.schedule('*/2 * * * *', async () => {
    const afectados = await deportesService.cerrarApuestasEventosIniciados();
    if (afectados > 0) {
      console.log(`[deportes.job] Apuestas cerradas en ${afectados} evento(s) iniciados`);
      io?.to('all').emit('eventos_actualizados');
    }
  }, { timezone: 'America/Caracas' });

  // Actualizar resultados y resolver tickets → cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    await deportesService.actualizarResultados();
    io?.to('all').emit('tickets_actualizados');
  }, { timezone: 'America/Caracas' });

  console.log('[deportes.job] Crons registrados → sync 1h | cierre 2min | resultados 5min');
}

module.exports = { iniciar };