'use strict';

const { redis } = require('../config/redis');

// Factory: crea un rate limiter configurable
function crearLimiter({ ventanaSegundos = 60, maxPeticiones = 100, mensaje = 'Demasiadas peticiones' } = {}) {
  return async (req, res, next) => {
    const ip    = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const key   = `rl:${req.path}:${ip}`;

    try {
      const actual = await redis.incr(key);
      if (actual === 1) await redis.expire(key, ventanaSegundos);

      res.setHeader('X-RateLimit-Limit',     maxPeticiones);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxPeticiones - actual));

      if (actual > maxPeticiones) {
        return res.status(429).json({ error: mensaje });
      }
      next();
    } catch {
      // Si Redis falla no bloqueamos la petición
      next();
    }
  };
}

// Limiters predefinidos
const limiterLogin       = crearLimiter({ ventanaSegundos: 60,  maxPeticiones: 10,  mensaje: 'Demasiados intentos de login. Espera 1 minuto.' });
const limiterApi         = crearLimiter({ ventanaSegundos: 60,  maxPeticiones: 120, mensaje: 'Límite de peticiones alcanzado.' });
const limiterCrearTicket = crearLimiter({ ventanaSegundos: 10,  maxPeticiones: 5,   mensaje: 'Creando tickets muy rápido. Espera un momento.' });

module.exports = { crearLimiter, limiterLogin, limiterApi, limiterCrearTicket };