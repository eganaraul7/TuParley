'use strict';

const { redis } = require('../config/redis');

// Factory: crea un rate limiter configurable.
// porUsuario: cuenta por usuario autenticado (si lo hay) en lugar de por IP.
// La clave incluye el nombre del limiter para que dos limiters en la misma ruta
// no compartan contador.
function crearLimiter({ nombre, ventanaSegundos = 60, maxPeticiones = 100, porUsuario = false, porRuta = false,
  mensaje = 'Demasiadas peticiones' } = {}) {
  return async (req, res, next) => {
    const sujeto = porUsuario && req.usuario?.id ? `u${req.usuario.id}` : `ip${req.ip}`;
    const ruta   = porRuta ? `:${req.baseUrl}${req.path}` : '';
    const key    = `rl:${nombre}:${sujeto}${ruta}`;

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

const num = (v, d) => parseInt(v ?? '', 10) || d;

// Limiters predefinidos (ajustables por .env)
const limiterLogin       = crearLimiter({ nombre: 'login', ventanaSegundos: 60, porRuta: true,
  maxPeticiones: num(process.env.RATE_LIMIT_LOGIN_MIN, 10), mensaje: 'Demasiados intentos de login. Espera 1 minuto.' });
const limiterApi         = crearLimiter({ nombre: 'api', ventanaSegundos: 60, porUsuario: true,
  maxPeticiones: num(process.env.RATE_LIMIT_API_MIN, 300), mensaje: 'Límite de peticiones alcanzado.' });
const limiterCrearTicket = crearLimiter({ nombre: 'ticket', ventanaSegundos: 10, porUsuario: true,
  maxPeticiones: num(process.env.RATE_LIMIT_TICKETS_10S, 5), mensaje: 'Creando tickets muy rápido. Espera un momento.' });

module.exports = { crearLimiter, limiterLogin, limiterApi, limiterCrearTicket };
