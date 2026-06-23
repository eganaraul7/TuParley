'use strict';
const crypto = require('crypto');

// ✅ FIX: keys coinciden exactamente con ticket.controller.js
function generarHashTicket(data) {
  const payload = {
    numeroSerie:      data.numeroSerie,
    bodega_id:        data.bodega_id,
    usuarioId:        data.usuarioId,
    montoUsd:         data.montoUsd,
    cuotaCombinada:   data.cuotaCombinada,
    seleccionesValidas: data.seleccionesValidas,
    ts:               data.ts,
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function verificarHashTicket(data, hashEsperado) {
  return generarHashTicket(data) === hashEsperado;
}

module.exports = { generarHashTicket, verificarHashTicket };