'use strict';

/**
 * redis.js — Cliente Redis con ioredis.
 * Usos: caché de tasa BCV, sesiones JWT, pub/sub para WebSocket.
 *
 * Keys usadas en el sistema:
 *   bcv:tasa_actual          → tasa BCV vigente (string, TTL 24h)
 *   sesion:{usuario_id}      → token JWT activo (TTL = JWT_EXPIRES_IN)
 *   bloqueado:{usuario_id}   → usuario bloqueado (sin TTL, desbloqueo manual)
 *   mantenimiento            → '1' si sistema en mantenimiento
 *   cuota:cache:{evento_id}  → cuotas de evento (TTL 1h)
 */

const Redis = require('ioredis');
const env   = require('./env');

const redisConfig = {
  host           : env.REDIS_HOST,
  port           : env.REDIS_PORT,
  password       : env.REDIS_PASSWORD || undefined,
  tls            : env.REDIS_TLS ? {} : undefined,
  retryStrategy  : (times) => {
    if (times > 10) {
      console.error('[Redis] Demasiados intentos de reconexión. Abortando.');
      return null; // no reintentar
    }
    const delay = Math.min(times * 200, 3000);
    console.warn(`[Redis] Reintentando conexión en ${delay}ms (intento ${times})...`);
    return delay;
  },
  lazyConnect    : false,
  enableOfflineQueue: true,
  connectTimeout : 10000,
  commandTimeout : 5000,
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log(`[Redis] Conectado → ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on('error', (err) => {
  console.error('[Redis] Error:', err.message);
});

redis.on('reconnecting', () => {
  console.warn('[Redis] Reconectando...');
});

// ── Helpers tipados ──────────────────────────────────────────────────────────

/**
 * Guarda un valor con TTL opcional.
 * @param {string} key
 * @param {string|number|object} value — objetos se serializan a JSON
 * @param {number} [ttlSeconds]
 */
async function setCache(key, value, ttlSeconds = null) {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (ttlSeconds) {
    await redis.set(key, serialized, 'EX', ttlSeconds);
  } else {
    await redis.set(key, serialized);
  }
}

/**
 * Obtiene un valor. Retorna null si no existe.
 * @param {string} key
 * @param {boolean} [parseJson]
 * @returns {Promise<string|object|null>}
 */
async function getCache(key, parseJson = false) {
  const value = await redis.get(key);
  if (value === null) return null;
  if (parseJson) {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

/**
 * Elimina una o varias claves.
 * @param {...string} keys
 */
async function delCache(...keys) {
  if (keys.length > 0) await redis.del(...keys);
}

/**
 * Verifica conexión al arrancar el servidor.
 */
async function testConnection() {
  try {
    await redis.ping();
    console.log('[Redis] Ping OK');
  } catch (err) {
    console.error('[Redis] No se pudo conectar:', err.message);
    process.exit(1);
  }
}

// ── Constantes de keys para uso centralizado ─────────────────────────────────
const KEYS = {
  BCV_TASA_ACTUAL       : 'bcv:tasa_actual',
  MANTENIMIENTO         : 'mantenimiento',
  sesion                : (usuarioId) => `sesion:${usuarioId}`,
  bloqueado             : (usuarioId) => `bloqueado:${usuarioId}`,
  cuotaCache            : (eventoId)  => `cuota:cache:${eventoId}`,
  intentosFallidos      : (usuarioId) => `intentos:${usuarioId}`,
};

const TTL = {
  BCV_TASA    : 86400,   // 24 horas
  SESION      : 50400,   // 14 horas (horario laboral)
  CUOTA_CACHE : 3600,    // 1 hora
  INTENTOS    : 3600,    // 1 hora (se reinicia con el día)
};

module.exports = {
  redis,
  setCache,
  getCache,
  delCache,
  testConnection,
  KEYS,
  TTL,
};