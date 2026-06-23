'use strict';

const jwt     = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { getCache, KEYS } = require('../config/redis');

const ROLES_ADMIN = ['computadora_madre', 'administrador'];

module.exports = function iniciarSocket(io) {
  // Middleware de autenticación WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Token requerido'));

      const payload = jwt.verify(token, JWT_SECRET);
      const sesion  = await getCache(KEYS.sesion(payload.id), true);
      if (!sesion)  return next(new Error('Sesión inválida'));

      socket.usuario = payload;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const { id, rol, bodega_id } = socket.usuario;

    // Salas por rol
    socket.join('all');
    if (ROLES_ADMIN.includes(rol)) socket.join('admins');
    if (rol === 'bodeguero' && bodega_id) socket.join(`bodega:${bodega_id}`);
    socket.join(`usuario:${id}`);

    // Ping/pong para mantener conexión viva
    socket.on('ping', () => socket.emit('pong'));

    // Cliente solicita tasa BCV actual
    socket.on('solicitar_bcv', async () => {
      const cached = await getCache(KEYS.BCV_TASA_ACTUAL, true);
      socket.emit('bcv_actualizada', { valor: cached?.valor ?? null });
    });

    socket.on('disconnect', () => {});
  });

  // Helpers globales disponibles para controllers/jobs
  io.emitirAdmin   = (evento, data) => io.to('admins').emit(evento, data);
  io.emitirBodega  = (bodega_id, evento, data) => io.to(`bodega:${bodega_id}`).emit(evento, data);
  io.emitirUsuario = (usuario_id, evento, data) => io.to(`usuario:${usuario_id}`).emit(evento, data);
  io.emitirTodos   = (evento, data) => io.to('all').emit(evento, data);
};