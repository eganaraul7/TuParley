import { io } from 'socket.io-client';

/**
 * socket.js — singleton Socket.io client
 *
 * connectSocket(token) se llama una sola vez desde App.jsx cuando hay sesión.
 * Todos los hooks/páginas obtienen la misma instancia vía getSocket().
 */

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

let socket = null;

/**
 * connectSocket — crea (o reutiliza) la conexión autenticada
 * @param {string} token  JWT de sesión completo
 * @returns {import('socket.io-client').Socket}
 */
export function connectSocket(token) {
  if (socket?.connected) return socket;

  // si ya existe una instancia desconectada, destruirla antes de crear otra
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10_000,
  });

  socket.on('connect', () => {
    console.log('[socket] conectado:', socket.id);
  });

  socket.on('disconnect', (motivo) => {
    console.log('[socket] desconectado:', motivo);
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] error de conexión:', err.message);
  });

  return socket;
}

/**
 * disconnectSocket — cerrar conexión y limpiar listeners (logout)
 */
export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

/**
 * getSocket — obtener instancia activa (o null si no hay sesión)
 * @returns {import('socket.io-client').Socket | null}
 */
export function getSocket() {
  return socket;
}