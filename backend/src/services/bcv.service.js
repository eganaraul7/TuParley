'use strict';
const axios                             = require('axios');
const { query }                         = require('../config/db');
const { setCache, getCache, KEYS, TTL } = require('../config/redis');
const { API_BCV_URL, BCV_RANGO_MINIMO, BCV_RANGO_MAXIMO } = require('../config/env');

const RANGO_MIN = parseFloat(BCV_RANGO_MINIMO ?? 300);
const RANGO_MAX = parseFloat(BCV_RANGO_MAXIMO ?? 4000);

async function _notificarAdminBcv(mensaje) {
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol) VALUES ('api_bcv_caida', ?, 'ambos')`,
    [mensaje]
  );
}

async function obtenerTasaActual() {
  const cached = await getCache(KEYS.BCV_TASA_ACTUAL, true);
  if (cached?.valor) return parseFloat(cached.valor);
  const rows = await query(
    `SELECT valor FROM tasa_bcv WHERE validada = 1 ORDER BY fecha DESC, id DESC LIMIT 1`
  );
  return rows.length > 0 ? parseFloat(rows[0].valor) : null;
}

async function actualizarTasaDesdeApi() {
  try {
    const res   = await axios.get(API_BCV_URL, { timeout: 8000 });
    const valor = parseFloat(res.data?.USD ?? res.data?.dolar ?? res.data?.bcv ?? 0);

    if (!valor) {
      await _notificarAdminBcv(
        `API BCV retornó valor fuera de rango (${valor} Bs/$). Tasa manual requerida.`
      );
      return { exito: false, valor, motivo: 'fuera_de_rango' };
    }

    // ✅ FIX: INSERT simple, sin ON DUPLICATE KEY (fecha no tiene UNIQUE)
    await query(
      `INSERT INTO tasa_bcv (valor, fuente, validada, fecha) VALUES (?, 'api', 1, CURDATE())`,
      [valor]
    );
    await setCache(KEYS.BCV_TASA_ACTUAL, JSON.stringify({ valor }), TTL.BCV_TASA);
    return { exito: true, valor };
  } catch (err) {
    await _notificarAdminBcv(`API BCV no disponible: ${err.message}. Tasa manual requerida.`);
    return { exito: false, motivo: 'api_caida', error: err.message };
  }
}

async function setTasaManual(valor, usuario_id) {
  const v = parseFloat(valor);
  if (!v)
    throw new Error(`Valor fuera del rango permitido (${RANGO_MIN}–${RANGO_MAX} Bs/$)`);
  await query(
    `INSERT INTO tasa_bcv (valor, fuente, validada, actualizado_por, fecha)
      VALUES (?, 'manual', 1, ?, CURDATE())`,
    [v, usuario_id]
  );
  await setCache(KEYS.BCV_TASA_ACTUAL, JSON.stringify({ valor: v }), TTL.BCV_TASA);
  return v;
}

module.exports = { obtenerTasaActual, actualizarTasaDesdeApi, setTasaManual };