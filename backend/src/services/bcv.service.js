'use strict';

/**
 * bcv.service.js — tasa oficial Bs/$ (BCV).
 *
 * Fuente principal: BCV_API_URL (DolarAPI, formato { promedio, compra, venta, fechaActualizacion }).
 * Fuente de respaldo opcional: BCV_API_URL_RESPALDO (mismo formato o { price }).
 * Cada fuente se intenta hasta 3 veces. Si todo falla, la tasa vigente se mantiene,
 * se avisa al admin (una vez por día) y el admin puede cargarla a mano.
 * Una tasa manual del día no la pisa la consulta automática; solo la consulta
 * forzada desde el panel (botón "Consultar API ahora").
 */

const axios                             = require('axios');
const { query }                         = require('../config/db');
const { setCache, getCache, KEYS, TTL } = require('../config/redis');
const { BCV_API_URL, BCV_API_URL_RESPALDO, BCV_RANGO_MINIMO, BCV_RANGO_MAXIMO } = require('../config/env');
const { extraerValor } = require('./bcvRespuesta');

const RANGO_MIN  = BCV_RANGO_MINIMO;
const RANGO_MAX  = BCV_RANGO_MAXIMO;
const INTENTOS   = 3;
const KEY_ESTADO = 'bcv:estado_api';

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

function _enRango(valor) {
  return Number.isFinite(valor) && valor >= RANGO_MIN && valor <= RANGO_MAX;
}

async function _notificarAdminBcv(mensaje) {
  try {
    // Una sola notificación sin leer por día: el reintento horario no debe llenar la bandeja
    const ya = await query(
      `SELECT id FROM notificaciones WHERE tipo = 'api_bcv_caida' AND leido = 0 AND DATE(created_at) = CURDATE() LIMIT 1`
    );
    if (ya.length > 0) return;
    await query(
      `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol) VALUES ('api_bcv_caida', ?, 'ambos')`,
      [mensaje]
    );
  } catch (err) {
    console.warn('[bcv.service] No se pudo insertar notificación:', err.message);
  }
}

async function _guardarEstado(estado) {
  try { await setCache(KEY_ESTADO, { ...estado, fecha: new Date().toISOString() }, 7 * 86400); } catch { /* opcional */ }
}

async function obtenerEstadoApi() {
  try { return await getCache(KEY_ESTADO, true); } catch { return null; }
}

// Tasa vigente con metadatos { valor, fuente, fecha, es_de_hoy } o null si no hay ninguna
async function obtenerTasaDetalle() {
  const rows = await query(
    `SELECT valor, fuente, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, fecha = CURDATE() AS es_de_hoy
       FROM tasa_bcv WHERE validada = 1 ORDER BY fecha DESC, id DESC LIMIT 1`
  );
  if (rows.length === 0) return null;
  const tasa = { valor: parseFloat(rows[0].valor), fuente: rows[0].fuente, fecha: rows[0].fecha, es_de_hoy: !!rows[0].es_de_hoy };
  await setCache(KEYS.BCV_TASA_ACTUAL, tasa, TTL.BCV_TASA);
  return tasa;
}

async function obtenerTasaActual() {
  const cached = await getCache(KEYS.BCV_TASA_ACTUAL, true);
  if (cached?.valor) return parseFloat(cached.valor);
  const tasa = await obtenerTasaDetalle();
  return tasa ? tasa.valor : null;
}

async function _guardarTasa(valor, fuente, usuario_id = null) {
  // Evita filas repetidas si el valor del día no cambió
  const [hoy] = await query(
    `SELECT id, valor, fuente FROM tasa_bcv WHERE fecha = CURDATE() AND validada = 1 ORDER BY id DESC LIMIT 1`
  );
  if (!(hoy && parseFloat(hoy.valor) === valor && hoy.fuente === fuente)) {
    await query(
      `INSERT INTO tasa_bcv (valor, fuente, validada, actualizado_por, fecha) VALUES (?, ?, 1, ?, CURDATE())`,
      [valor, fuente, usuario_id]
    );
  }
  return obtenerTasaDetalle();
}

// Consulta una fuente con reintentos; devuelve el valor o lanza el último error
async function _consultarFuente(url) {
  let ultimoError;
  for (let i = 1; i <= INTENTOS; i++) {
    try {
      const res   = await axios.get(url, { timeout: 8000, headers: { Accept: 'application/json' } });
      const valor = extraerValor(res.data);
      if (valor === null) throw new Error('respuesta sin valor de tasa');
      return valor;
    } catch (err) {
      ultimoError = err;
      if (i < INTENTOS) await esperar(1000 * i);
    }
  }
  throw ultimoError;
}

/**
 * Actualiza la tasa desde la API.
 * @param {{ forzar?: boolean }} opciones forzar=true reemplaza también una tasa manual del día
 * @returns {{ exito: boolean, valor?: number, motivo?: string, error?: string, omitida?: boolean }}
 */
async function actualizarTasaDesdeApi({ forzar = false } = {}) {
  if (!forzar) {
    const [manualHoy] = await query(
      `SELECT valor FROM tasa_bcv WHERE fecha = CURDATE() AND fuente = 'manual' AND validada = 1 ORDER BY id DESC LIMIT 1`
    );
    if (manualHoy) return { exito: true, omitida: true, valor: parseFloat(manualHoy.valor), motivo: 'manual_del_dia' };
  }

  const fuentes = [BCV_API_URL, BCV_API_URL_RESPALDO].filter(Boolean);
  const errores = [];
  for (const url of fuentes) {
    try {
      const valor = await _consultarFuente(url);
      if (!_enRango(valor)) {
        errores.push(`${new URL(url).host}: valor ${valor} fuera de rango (${RANGO_MIN}–${RANGO_MAX})`);
        continue;
      }
      await _guardarTasa(valor, 'api');
      await _guardarEstado({ exito: true, valor, fuente_url: new URL(url).host });
      return { exito: true, valor };
    } catch (err) {
      errores.push(`${new URL(url).host}: ${err.message}`);
    }
  }

  const detalle = errores.join(' | ');
  const fueraDeRango = errores.length > 0 && errores.every((e) => e.includes('fuera de rango'));
  await _guardarEstado({ exito: false, error: detalle });
  await _notificarAdminBcv(
    fueraDeRango
      ? `La API BCV devolvió una tasa fuera del rango permitido (${detalle}). Cárgala a mano o ajusta BCV_RANGO_MINIMO/MAXIMO.`
      : `API BCV no disponible (${detalle}). Carga la tasa del día a mano en Admin → BCV.`
  );
  return { exito: false, motivo: fueraDeRango ? 'fuera_de_rango' : 'api_caida', error: detalle };
}

async function setTasaManual(valor, usuario_id) {
  const v = Math.round(parseFloat(valor) * 10000) / 10000;
  if (!_enRango(v))
    throw new Error(`Valor fuera del rango permitido (${RANGO_MIN}–${RANGO_MAX} Bs/$)`);
  await _guardarTasa(v, 'manual', usuario_id);
  return v;
}

// ¿Ya hay tasa válida de hoy? (para el reintento horario)
async function hayTasaDeHoy() {
  const [row] = await query(`SELECT id FROM tasa_bcv WHERE fecha = CURDATE() AND validada = 1 LIMIT 1`);
  return !!row;
}

module.exports = {
  obtenerTasaActual, obtenerTasaDetalle, obtenerEstadoApi, actualizarTasaDesdeApi,
  setTasaManual, hayTasaDeHoy, extraerValor, RANGO_MIN, RANGO_MAX,
};
