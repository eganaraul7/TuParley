// Nombre de archivo: env.js
// Ruta: backend/src/config/env.js
// Función: Centraliza todas las variables de entorno del backend

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  // ── Servidor ──────────────────────────────────────────────────────────────
  NODE_ENV : process.env.NODE_ENV  || 'development',
  PORT     : parseInt(process.env.PORT || '4000', 10),
  HOST     : process.env.HOST      || '0.0.0.0',

  // ── Base de datos ─────────────────────────────────────────────────────────
  DB_HOST     : process.env.DB_HOST     || 'localhost',
  DB_PORT     : parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER     : process.env.DB_USER     || 'root',
  DB_PASSWORD : process.env.DB_PASSWORD || '',
  DB_NAME     : process.env.DB_NAME     || 'tuparley',
  DB_POOL_MAX : parseInt(process.env.DB_POOL_MAX || '10', 10),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_HOST     : process.env.REDIS_HOST     || 'localhost',
  REDIS_PORT     : parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD : process.env.REDIS_PASSWORD || '',
  REDIS_TLS      : process.env.REDIS_TLS === 'true',

  // ── JWT ───────────────────────────────────────────────────────────────────
  JWT_SECRET         : process.env.JWT_SECRET          || '',
  JWT_EXPIRES_IN     : process.env.JWT_EXPIRES_IN      || '12h',
  JWT_REFRESH_SECRET : process.env.JWT_REFRESH_SECRET  || 'refresh_cambiar_en_produccion',

  // ── 2FA ───────────────────────────────────────────────────────────────────
  TOTP_ISSUER : process.env.TOTP_ISSUER || 'TuParley',

  // ── APIs de deportes (API-Sports) ─────────────────────────────────────────
  API_SPORTS_KEY            : process.env.API_SPORTS_KEY             || '45f2d19dd61834d09e9acb00b17f6fe4',
  API_SPORTS_URL_FUTBOL     : process.env.API_SPORTS_URL_FUTBOL      || 'https://v3.football.api-sports.io',
  API_SPORTS_URL_BALONCESTO : process.env.API_SPORTS_URL_BALONCESTO  || 'https://v1.basketball.api-sports.io',
  API_SPORTS_URL_BEISBOL    : process.env.API_SPORTS_URL_BEISBOL     || 'https://v1.baseball.api-sports.io',
  API_SPORTS_URL_MMA        : process.env.API_SPORTS_URL_MMA         || 'https://v1.mma.api-sports.io',

  // ── API de tenis (RapidAPI independiente) ─────────────────────────────────
  API_TENNIS_KEY        : process.env.API_TENNIS_KEY        || '7612a7c4c3mshf2a2e80991228d6p1b70f5jsn9014f92f9033',
  API_SPORTS_URL_TENIS  : process.env.API_SPORTS_URL_TENIS  || 'https://api-tennis.p.rapidapi.com',

  // ── API BCV ───────────────────────────────────────────────────────────────
  // API_BCV_URL se acepta como alias (nombre usado en versiones anteriores del README)
  BCV_API_URL      : process.env.BCV_API_URL || process.env.API_BCV_URL || 'https://ve.dolarapi.com/v1/dolares/oficial',
  // Fuente alternativa opcional (se consulta si la principal falla)
  BCV_API_URL_RESPALDO : process.env.BCV_API_URL_RESPALDO || '',
  BCV_RANGO_MINIMO : parseFloat(process.env.BCV_RANGO_MINIMO || '100'),
  BCV_RANGO_MAXIMO : parseFloat(process.env.BCV_RANGO_MAXIMO || '5000'),

  // ── Almacenamiento (DigitalOcean Spaces) ──────────────────────────────────
  SPACES_KEY      : process.env.SPACES_KEY      || '',
  SPACES_SECRET   : process.env.SPACES_SECRET   || '',
  SPACES_ENDPOINT : process.env.SPACES_ENDPOINT || '',
  SPACES_BUCKET   : process.env.SPACES_BUCKET   || '',
  SPACES_REGION   : process.env.SPACES_REGION   || 'nyc3',

  // ── Apuestas (límites) ────────────────────────────────────────────────────
  GANANCIA_MAXIMA_USD : parseFloat(process.env.GANANCIA_MAXIMA_USD || '300'),
  APUESTA_MINIMA_USD  : parseFloat(process.env.APUESTA_MINIMA_USD  || '1'),

  // ── Frontend / proxy ──────────────────────────────────────────────────────
  FRONTEND_URL : process.env.FRONTEND_URL || '',
  // Orígenes extra separados por coma (ej. http://192.168.1.50:5173 para tablets en LAN)
  CORS_ORIGINS : (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  // Valor para app.set('trust proxy'): 'loopback' sirve detrás de Nginx en el mismo servidor
  TRUST_PROXY  : process.env.TRUST_PROXY || 'loopback',
};

// JWT_SECRET: obligatorio en producción. En desarrollo, si falta, se genera uno
// aleatorio por proceso (las sesiones se cierran al reiniciar el backend).
const SECRETOS_INSEGUROS = ['', 'cambiar_en_produccion'];
if (SECRETOS_INSEGUROS.includes(process.env.JWT_SECRET || '') || (process.env.JWT_SECRET || '').length < 32) {
  if (env.NODE_ENV === 'production') {
    console.error('[env] JWT_SECRET ausente o débil (mínimo 32 caracteres). Configúralo en backend/.env');
    process.exit(1);
  }
  console.warn('[env] JWT_SECRET ausente o débil: se usa uno temporal. Configúralo en backend/.env');
  env.JWT_SECRET = require('crypto').randomBytes(48).toString('hex');
}

module.exports = env;