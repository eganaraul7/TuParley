import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/socket';

/**
 * useSocket — suscribirse a un evento de Socket.io con limpieza automática
 *
 * El callback se guarda en un ref para evitar resuscripciones innecesarias
 * cuando el componente padre re-renderiza con una nueva función inline
 * (patrón común: useSocket('evento', () => cargar())).
 *
 * @param {string} evento     Nombre del evento del servidor (ver socket.handler.js)
 * @param {Function} callback Se invoca con el payload del evento
 *
 * @example
 *   useSocket('tickets_actualizados', () => recargarLista());
 *   useSocket('notificacion', (payload) => mostrarToast(payload));
 *   useSocket('mantenimiento', ({ activo }) => { if (activo) navigate('/login'); });
 */
export function useSocket(evento, callback) {
  const callbackRef = useRef(callback);

  // Mantener siempre la versión más reciente del callback sin re-suscribir
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    function handler(payload) {
      callbackRef.current?.(payload);
    }

    socket.on(evento, handler);
    return () => {
      socket.off(evento, handler);
    };
  }, [evento]);
}

/**
 * useSocketStatus — estado de conexión del socket en tiempo real
 *
 * Útil para indicadores visuales (ej. punto verde/rojo de "en línea").
 *
 * @returns {boolean} true si el socket está actualmente conectado
 *
 * @example
 *   const conectado = useSocketStatus();
 *   <Wifi className={conectado ? 'text-[#10b981]' : 'text-[#ef4444]'} />
 */
export function useSocketStatus() {
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    setConectado(socket.connected);

    function onConnect()    { setConectado(true); }
    function onDisconnect() { setConectado(false); }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return conectado;
}

export default useSocket;