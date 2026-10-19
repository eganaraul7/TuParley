'use strict';
const cron            = require('node-cron');
const deportesService = require('../services/deportes.service');

// Envuelve cada tarea: un error no debe tumbar el proceso ni solaparse con la siguiente ejecución
function tarea(nombre, fn) {
  let enCurso = false;
  return async () => {
    if (enCurso) return;
    enCurso = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[deportes.job] ${nombre}:`, err.message);
    } finally {
      enCurso = false;
    }
  };
}

function iniciar(io) {
  // Sincronizar eventos de los próximos días → cada 6 horas (plan gratuito: ~100 peticiones/día por API)
  cron.schedule('15 */6 * * *', tarea('sync', async () => {
    console.log('[deportes.job] Sincronizando eventos...');
    const r = await deportesService.sincronizarEventosSemana();
    console.log(`[deportes.job] Creados: ${r.creados} | Actualizados: ${r.actualizados} | Errores: ${r.errores.length}`);
    if (r.errores.length) console.warn('[deportes.job] Errores:', r.errores.slice(0, 5));
    if (r.creados || r.actualizados) io?.to('all').emit('eventos_actualizados');
  }), { timezone: 'America/Caracas' });

  // Cerrar apuestas de eventos iniciados → cada minuto (solo consulta la BD)
  cron.schedule('* * * * *', tarea('cierre', async () => {
    const afectados = await deportesService.cerrarApuestasEventosIniciados();
    if (afectados > 0) {
      console.log(`[deportes.job] Apuestas cerradas en ${afectados} evento(s) iniciados`);
      io?.to('all').emit('eventos_actualizados');
    }
  }), { timezone: 'America/Caracas' });

  // Actualizar resultados y liquidar tickets → cada 30 minutos
  cron.schedule('*/30 * * * *', tarea('resultados', async () => {
    const r = await deportesService.actualizarResultados();
    if (r.errores.length) console.warn('[deportes.job] Errores resultados:', r.errores.slice(0, 5));
    if (r.finalizados || r.suspendidos) io?.to('all').emit('tickets_actualizados');
  }), { timezone: 'America/Caracas' });

  console.log('[deportes.job] Crons registrados → sync 6h | cierre 1min | resultados 30min');
}

module.exports = { iniciar, tarea };
