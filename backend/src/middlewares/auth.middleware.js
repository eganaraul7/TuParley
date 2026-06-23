'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { getCache, KEYS } = require('../config/redis');

const ROLES_ADMIN = ['computadora_madre', 'administrador'];

async function verificarToken(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Verificar sesión activa en Redis
    const sesionCached = await getCache(KEYS.sesion(payload.id), true);
    if (!sesionCached) {
      return res.status(401).json({ error: 'Sesión expirada o cerrada. Inicia sesión nuevamente.' });
    }

    // Verificar modo mantenimiento (solo bloquea no-admins)
    if (!ROLES_ADMIN.includes(payload.rol)) {
      const mantenimiento = await getCache(KEYS.MANTENIMIENTO);
      if (mantenimiento === '1') {
        return res.status(503).json({ error: 'Sistema en mantenimiento.', mantenimiento: true });
      }
    }

    req.usuario = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { verificarToken };