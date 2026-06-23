'use strict';
const cron        = require('node-cron');
const bcvService  = require('../services/bcv.service');

// Cada día a las 9:00 AM hora Venezuela
function iniciar(io) {
  cron.schedule('0 9 * * *', async () => {
    console.log('[bcv.job] Actualizando tasa BCV...');
    const resultado = await bcvService.actualizarTasaDesdeApi();
    if (resultado.exito) {
      io?.to('all').emit('bcv_actualizada', { valor: resultado.valor });
      console.log(`[bcv.job] Tasa actualizada: ${resultado.valor} Bs/$`);
    } else {
      console.warn('[bcv.job] Fallo:', resultado.motivo);
    }
  }, { timezone: 'America/Caracas' });

  console.log('[bcv.job] Cron registrado → 9:00 AM diario');
}

module.exports = { iniciar };