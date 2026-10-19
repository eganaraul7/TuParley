'use strict';
const { FRONTEND_URL, CORS_ORIGINS, NODE_ENV } = require('./env');

// Orígenes permitidos para HTTP y Socket.io
const ORIGENES_FIJOS = [
  FRONTEND_URL,
  ...CORS_ORIGINS,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
].filter(Boolean);

// En desarrollo se aceptan tablets de la red local (Vite en :5173) sin configurar nada
const LAN_DEV = /^http:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):(5173|4173)$/;

function origenPermitido(origin, callback) {
  // Peticiones sin Origin (curl, apps nativas, mismo origen) no aplican CORS
  if (!origin || ORIGENES_FIJOS.includes(origin) || (NODE_ENV !== 'production' && LAN_DEV.test(origin))) {
    return callback(null, true);
  }
  return callback(null, false);
}

module.exports = { ORIGENES_PERMITIDOS: origenPermitido, ORIGENES_FIJOS };
