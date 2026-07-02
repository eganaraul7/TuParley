'use strict';

/**
 * env.js — Carga y valida todas las variables de entorno.
 * Si alguna variable OBLIGATORIA falta, el proceso termina
 * inmediatamente para evitar arrancar con configuración incompleta.
 */

require('dotenv').config();

const REQUIRED = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
];

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[ENV] Variables de entorno faltantes: ${missing.join(', ')}\n` +
    `Copia .env.example → .env y completa los valores.`
  );
  process.exit(1);
}

const env = {
  // ── Node ────────────────────────────────────────────────────
  NODE_ENV   : process.env.NODE_ENV    || 'development',
  PORT       : parseInt(process.env.PORT || '4000', 10),

  // ── MySQL ────────────────────────────────────────────────────
  DB_HOST     : process.env.DB_HOST,
  DB_PORT     : parseInt(process.env.DB_PORT, 10),
  DB_NAME     : process.env.DB_NAME,
  DB_USER     : process.env.DB_USER,
  DB_PASSWORD : process.env.DB_PASSWORD,
  DB_POOL_MIN : parseInt(process.env.DB_POOL_MIN || '2',  10),
  DB_POOL_MAX : parseInt(process.env.DB_POOL_MAX || '20', 10),

  // ── Redis ────────────────────────────────────────────────────
  REDIS_HOST     : process.env.REDIS_HOST,
  REDIS_PORT     : parseInt(process.env.REDIS_PORT, 10),
  REDIS_PASSWORD : process.env.REDIS_PASSWORD || null,
  REDIS_TLS      : process.env.REDIS_TLS === 'true',

  // ── JWT ──────────────────────────────────────────────────────
  JWT_SECRET     : process.env.JWT_SECRET,
  JWT_EXPIRES_IN : process.env.JWT_EXPIRES_IN, // e.g. '14h'

  // ── TOTP (2FA) ────────────────────────────────────────────────
  TOTP_APP_NAME : process.env.TOTP_APP_NAME || 'TuParley',

  // ── APIs externas ────────────────────────────────────────────
  API_SPORTS_KEY          : process.env.API_SPORTS_KEY           || '45f2d19dd61834d09e9acb00b17f6fe4',
  API_SPORTS_URL_FUTBOL   : process.env.API_SPORTS_URL_FUTBOL    || 'https://v3.football.api-sports.io',
  API_SPORTS_URL_BALONCESTO: process.env.API_SPORTS_URL_BALONCESTO || 'https://v1.basketball.api-sports.io',
  API_SPORTS_URL_BEISBOL  : process.env.API_SPORTS_URL_BEISBOL   || 'https://v1.baseball.api-sports.io',

  API_TENNIS_KEY            : process.env.API_TENNIS_KEY             || '45f2d19dd61834d09e9acb00b17f6fe4',
  API_SPORTS_URL_TENIS    : process.env.API_SPORTS_URL_TENIS     || 'https://tennisapi1.p.rapidapi.com/api/tennis/event/14232981/odds',

  API_RACING_KEY          : process.env.API_RACING_KEY           || '',
  API_RACING_URL          : process.env.API_RACING_URL           || '',

  API_BCV_URL             : process.env.API_BCV_URL              || 'https://ve.dolarapi.com/v1/dolares/oficial',

  // ── Zona horaria ─────────────────────────────────────────────
  TZ: 'America/Caracas',

  // ── Negocio ──────────────────────────────────────────────────
  MAX_GANANCIA_USD    : parseFloat(process.env.MAX_GANANCIA_USD    || '300'),
  APUESTA_MINIMA_USD  : parseFloat(process.env.APUESTA_MINIMA_USD  || '1'),
  BCV_RANGO_MINIMO    : parseFloat(process.env.BCV_RANGO_MINIMO    || '30'),
  BCV_RANGO_MAXIMO    : parseFloat(process.env.BCV_RANGO_MAXIMO    || '200'),
  HORAS_VENCIMIENTO_PREMIO: parseInt(process.env.HORAS_VENCIMIENTO_PREMIO || '48', 10),
};

module.exports = env;