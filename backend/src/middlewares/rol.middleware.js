'use strict';

const ROLES_ADMIN = ['computadora_madre', 'administrador'];

// Uso: soloRoles('computadora_madre', 'administrador')
function soloRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso denegado para tu rol' });
    }
    next();
  };
}

// Shorthand para cualquier admin
function soloAdmin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
  if (!ROLES_ADMIN.includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Solo administradores' });
  }
  next();
}

// Shorthand para bodeguero o admin
function bodegueroOAdmin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
  if (!['computadora_madre', 'administrador', 'bodeguero'].includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// Bloquea al rol 'desconocido'
function noDesconocido(req, res, next) {
  if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
  if (req.usuario.rol === 'desconocido') {
    return res.status(403).json({ error: 'Acceso pendiente de aprobación', pendiente: true });
  }
  next();
}

module.exports = { soloRoles, soloAdmin, bodegueroOAdmin, noDesconocido };