'use strict';
const { query } = require('../config/db');

async function crear(tipo, mensaje, destinatario_rol, referencia_id = null, referencia_tipo = null) {
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
      VALUES (?,?,?,?,?)`,
    [tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo]
  );
}

async function emitirViaSocket(io, tipo, payload) {
  if (!io) return;
  io.to('admins').emit('notificacion', { tipo, ...payload });
}

const NotificacionService = {
  usuarioBloqueado:     (nombre, usuarioId, io) => {
    crear('usuario_bloqueado', `"${nombre}" bloqueado por intentos fallidos. ¿Desbloquear?`, 'ambos', usuarioId, 'usuarios');
    emitirViaSocket(io, 'usuario_bloqueado', { nombre, usuarioId });
  },
  solicitudReingreso:   (nombre, hora, usuarioId, io) => {
    crear('solicitud_reingreso', `"${nombre}" desea reingresar a las ${hora}. ¿Permite acceso? [Sí] / [No]`, 'ambos', usuarioId, 'usuarios');
    emitirViaSocket(io, 'solicitud_reingreso', { nombre, hora, usuarioId });
  },
  premioAltoPagado:     (serie, monto, bodegaId, io) => {
    crear('premio_alto_pagado', `Ticket ${serie} pagó $${monto} en bodega ${bodegaId}`, 'ambos', bodegaId, 'bodegas');
    emitirViaSocket(io, 'premio_alto_pagado', { serie, monto, bodegaId });
  },
  ticketCaducado:       (serie, ticketId, io) => {
    crear('ticket_caducado_ganador', `Ticket ${serie} superó las 48h sin cobrar → CADUCADO_GANADOR`, 'ambos', ticketId, 'tickets');
    emitirViaSocket(io, 'ticket_caducado', { serie, ticketId });
  },
  solicitudAnulacion:   (serie, solicitudId, io) => {
    crear('solicitud_anulacion', `Solicitud de anulación del ticket ${serie}. ¿Aprobar?`, 'ambos', solicitudId, 'solicitudes_anulacion');
    emitirViaSocket(io, 'solicitud_anulacion', { serie, solicitudId });
  },
  discrepanciaCaja:     (nombre, declarado, calculado, cierreId, io) => {
    crear('discrepancia_caja', `"${nombre}" reportó $${declarado} pero el sistema calculó $${calculado}`, 'ambos', cierreId, 'cierre_caja');
    emitirViaSocket(io, 'discrepancia_caja', { nombre, declarado, calculado });
  },
  eventoSuspendido:     (nombre, afectados, io) => {
    crear('evento_suspendido', `Evento "${nombre}" suspendido. ${afectados} tickets afectados`, 'ambos', null, null);
    emitirViaSocket(io, 'evento_suspendido', { nombre, afectados });
  },
  apiBcvCaida:          (motivo, io) => {
    crear('api_bcv_caida', `API BCV no disponible: ${motivo}. Tasa manual requerida.`, 'ambos', null, null);
    emitirViaSocket(io, 'api_bcv_caida', { motivo });
  },
  ticketGanador:        (serie, monto, ticketId, io) => {
    crear('ticket_ganador', `Ticket ${serie} marcado como GANADO — $${monto}`, 'ambos', ticketId, 'tickets');
    emitirViaSocket(io, 'ticket_ganador', { serie, monto, ticketId });
  },
};

module.exports = NotificacionService;