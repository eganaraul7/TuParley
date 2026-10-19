'use strict';
const cron       = require('node-cron');
const bcvService = require('../services/bcv.service');
const { tarea }  = require('./deportes.job');

async function _actualizar(io, origen) {
  const resultado = await bcvService.actualizarTasaDesdeApi();
  if (resultado.omitida) {
    console.log(`[bcv.job] ${origen}: se mantiene la tasa manual del día (${resultado.valor} Bs/$)`);
  } else if (resultado.exito) {
    io?.to('all').emit('bcv_actualizada', { valor: resultado.valor, fuente: 'api' });
    console.log(`[bcv.job] ${origen}: tasa actualizada ${resultado.valor} Bs/$`);
  } else {
    console.warn(`[bcv.job] ${origen}: fallo (${resultado.motivo}) ${resultado.error}`);
  }
}

function iniciar(io) {
  // Cada día a las 9:00 AM hora Venezuela
  cron.schedule('0 9 * * *', tarea('bcv', () => _actualizar(io, '9:00')), { timezone: 'America/Caracas' });

  // Reintento cada hora (7:30–20:30) mientras no exista tasa del día
  cron.schedule('30 7-20 * * *', tarea('bcv-reintento', async () => {
    if (await bcvService.hayTasaDeHoy()) return;
    await _actualizar(io, 'reintento');
  }), { timezone: 'America/Caracas' });

  console.log('[bcv.job] Cron registrado → 9:00 AM diario + reintento horario sin tasa del día');
}

module.exports = { iniciar };
