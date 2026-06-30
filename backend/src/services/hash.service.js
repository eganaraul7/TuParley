// Archivo: hash.service.js
// Ruta: backend/src/services/hash.service.js
'use strict';
const crypto = require('crypto');

function _serializarSelecciones(selecciones) {
  return JSON.stringify(
    [...selecciones]
      .map((s) => ({
        evento_id:      s.evento_id,
        modalidad_id:   s.modalidad_id,
        cuota_aplicada: s.cuota_aplicada,
      }))
      .sort((a, b) => a.evento_id - b.evento_id)
  );
}

function generarHashTicket({ numero_serie, bodega_id, usuario_id, monto_apostado_usd, cuota_combinada, selecciones, ts }) {
  const seleccionesValidas = _serializarSelecciones(selecciones);
  const base = [numero_serie, bodega_id, usuario_id, monto_apostado_usd, cuota_combinada, seleccionesValidas, ts].join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function verificarHashTicket(data, hashEsperado) {
  return generarHashTicket(data) === hashEsperado;
}

module.exports = { generarHashTicket, verificarHashTicket };