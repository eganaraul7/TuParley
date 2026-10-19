'use strict';

/**
 * liquidacion.service.js — resuelve selecciones y tickets a partir del
 * resultado de un evento.
 *
 * Resultado de evento normalizado:
 *   { gl, gv, ganador, detalle }
 *   gl / gv   → marcador (fútbol: tiempo reglamentario; baloncesto/béisbol: final;
 *               tenis: sets). null si no se conoce.
 *   ganador   → 'local' | 'empate' | 'visitante' | null (se deduce de gl/gv si falta)
 *   detalle   → 'tiempo_extra' | 'penales' | 'ko' | 'tko' | 'sumision' | 'decision'
 *               | 'ninguno' (se sabe que no hubo) | null (desconocido)
 *
 * evaluarSeleccion devuelve 'ganado' | 'perdido' | null. null significa que
 * faltan datos para decidir: la selección queda pendiente y se pide resultado
 * manual al administrador (nunca se marca como perdida por falta de datos).
 */

const { query, getConnection } = require('../config/db');

function _ganadorDesdeMarcador(gl, gv) {
  if (gl === null || gv === null || gl === undefined || gv === undefined) return null;
  return gl > gv ? 'local' : gl < gv ? 'visitante' : 'empate';
}

// Modalidades antiguas (texto libre en `seleccion`): solo se resuelven las inequívocas
function _evaluarLegacy(seleccion, { gl, gv }) {
  if (gl === null || gv === null || gl === undefined || gv === undefined) return null;
  const s = String(seleccion).trim().toLowerCase();
  if (s === '1' || s === 'local')     return gl > gv  ? 'ganado' : 'perdido';
  if (s === '2' || s === 'visitante') return gv > gl  ? 'ganado' : 'perdido';
  if (s === 'x' || s === 'empate')    return gl === gv ? 'ganado' : 'perdido';
  const m = s.match(/^(over|under)_(\d+(?:\.\d+)?)$/);
  if (m) {
    const total = gl + gv;
    const linea = parseFloat(m[2]);
    if (total === linea) return null;
    return (m[1] === 'over' ? total > linea : total < linea) ? 'ganado' : 'perdido';
  }
  return null;
}

function evaluarSeleccion(sel, resultado, deporte) {
  const tipo = sel.tipo_resultado;
  if (!tipo || tipo === 'no_aplica') return _evaluarLegacy(sel.seleccion, resultado);

  const { gl = null, gv = null } = resultado;
  const ganador = resultado.ganador ?? _ganadorDesdeMarcador(gl, gv);
  if (!ganador) return null;
  if (ganador !== tipo) return 'perdido';

  const tieneMarcador = sel.marcador_local !== null && sel.marcador_local !== undefined;
  if (tieneMarcador) {
    if (gl === null || gv === null) return null;
    const ml = Number(sel.marcador_local);
    const mv = Number(sel.marcador_visitante);
    const acierto = deporte === 'baloncesto'
      ? Math.abs(gl - gv) >= ml && Math.abs(gl - gv) <= mv
      : gl === ml && gv === mv;
    if (!acierto) return 'perdido';
  }

  if (sel.detalle_fin) {
    if (!resultado.detalle) return null;
    if (resultado.detalle !== sel.detalle_fin) return 'perdido';
  }

  return 'ganado';
}

// Resultado normalizado a partir de la fila del evento
function resultadoDesdeEvento(evento) {
  const m = String(evento.resultado_final ?? '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  const gl = m ? Number(m[1]) : null;
  const gv = m ? Number(m[2]) : null;
  let detalle = evento.detalle_fin_final ?? null;
  // En fútbol un partido finalizado sin detalle terminó en tiempo reglamentario
  if (!detalle && evento.deporte === 'futbol' && evento.estado === 'finalizado') detalle = 'ninguno';
  return { gl, gv, ganador: evento.ganador_final ?? _ganadorDesdeMarcador(gl, gv), detalle };
}

async function _horasVencimiento() {
  const [cfg] = await query(
    `SELECT valor FROM configuracion_sistema WHERE clave = 'horas_vencimiento_premio' LIMIT 1`
  );
  return parseFloat(cfg?.valor) || 48;
}

// Recalcula el estado de un ticket PENDIENTE según sus selecciones
async function resolverTicket(ticketId, horasVence) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [[ticket]] = await conn.query(
      `SELECT id, estado FROM tickets WHERE id = ? FOR UPDATE`, [ticketId]
    );
    if (!ticket || ticket.estado !== 'PENDIENTE') { await conn.rollback(); return null; }

    const [sels] = await conn.query(`SELECT resultado FROM selecciones_ticket WHERE ticket_id = ?`, [ticketId]);
    let nuevo = null;
    if (sels.some((s) => s.resultado === 'perdido')) {
      nuevo = 'PERDIDO';
      await conn.query(`UPDATE tickets SET estado = 'PERDIDO', updated_at = NOW() WHERE id = ?`, [ticketId]);
    } else if (sels.length > 0 && sels.every((s) => s.resultado === 'ganado')) {
      nuevo = 'GANADO';
      await conn.query(
        `UPDATE tickets SET estado = 'GANADO', fecha_estado_ganado = NOW(),
                fecha_vencimiento_cobro = NOW() + INTERVAL ? HOUR, updated_at = NOW()
          WHERE id = ?`,
        [horasVence, ticketId]
      );
      await conn.query(
        `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
          SELECT 'ticket_ganador', CONCAT('Ticket ', numero_serie, ' GANADO — $', ganancia_potencial_usd),
                 'ambos', id, 'tickets' FROM tickets WHERE id = ?`,
        [ticketId]
      );
    }
    await conn.commit();
    return nuevo;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function _notificarManual(evento) {
  const ya = await query(
    `SELECT id FROM notificaciones
      WHERE tipo = 'resultado_manual' AND referencia_tipo = 'eventos' AND referencia_id = ? AND leido = 0 LIMIT 1`,
    [evento.id]
  );
  if (ya.length > 0) return;
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
      VALUES ('resultado_manual', ?, 'ambos', ?, 'eventos')`,
    [`${evento.equipo_local} vs ${evento.equipo_visitante}: faltan datos para liquidar. Registra el resultado en Admin → Eventos.`, evento.id]
  );
}

/**
 * Liquida las selecciones pendientes de un evento finalizado.
 * @returns {{ resueltas: number, sinDatos: number, tickets: object }}
 */
async function liquidarEvento(eventoId) {
  const [evento] = await query(
    `SELECT id, deporte, estado, resultado_final, ganador_final, detalle_fin_final,
            equipo_local, equipo_visitante
       FROM eventos WHERE id = ? LIMIT 1`,
    [eventoId]
  );
  if (!evento || evento.estado !== 'finalizado') return { resueltas: 0, sinDatos: 0, tickets: {} };

  const resultado = resultadoDesdeEvento(evento);
  const sels = await query(
    `SELECT st.id, st.ticket_id, st.seleccion, st.tipo_resultado,
            st.marcador_local, st.marcador_visitante, st.detalle_fin
       FROM selecciones_ticket st
       JOIN tickets t ON t.id = st.ticket_id
      WHERE st.evento_id = ? AND st.resultado = 'pendiente' AND t.estado = 'PENDIENTE'`,
    [eventoId]
  );

  let resueltas = 0;
  let sinDatos  = 0;
  const ticketsAfectados = new Set();
  for (const sel of sels) {
    const r = evaluarSeleccion(sel, resultado, evento.deporte);
    if (!r) { sinDatos++; continue; }
    const upd = await query(
      `UPDATE selecciones_ticket SET resultado = ? WHERE id = ? AND resultado = 'pendiente'`, [r, sel.id]
    );
    if (upd.affectedRows) { resueltas++; ticketsAfectados.add(sel.ticket_id); }
  }

  const horas = await _horasVencimiento();
  const tickets = { GANADO: 0, PERDIDO: 0 };
  for (const id of ticketsAfectados) {
    const nuevo = await resolverTicket(id, horas);
    if (nuevo) tickets[nuevo]++;
  }

  if (sinDatos > 0) await _notificarManual(evento);
  return { resueltas, sinDatos, tickets };
}

// Evento suspendido/cancelado: sus tickets PENDIENTE quedan SUSPENDIDO (devolución a pedido)
async function suspenderEvento(eventoId, estado = 'suspendido') {
  await query(`UPDATE eventos SET estado = ?, updated_at = NOW() WHERE id = ?`, [estado, eventoId]);
  await query(
    `UPDATE selecciones_ticket SET resultado = 'suspendido' WHERE evento_id = ? AND resultado = 'pendiente'`,
    [eventoId]
  );
  const res = await query(
    `UPDATE tickets t JOIN selecciones_ticket st ON st.ticket_id = t.id
        SET t.estado = 'SUSPENDIDO', t.updated_at = NOW()
      WHERE st.evento_id = ? AND t.estado = 'PENDIENTE'`,
    [eventoId]
  );
  const [ev] = await query(`SELECT equipo_local, equipo_visitante FROM eventos WHERE id = ?`, [eventoId]);
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
      VALUES ('evento_suspendido', ?, 'ambos', ?, 'eventos')`,
    [`${ev?.equipo_local ?? 'Evento'} vs ${ev?.equipo_visitante ?? eventoId} ${estado}. Tickets afectados: ${res.affectedRows}`, eventoId]
  );
  return res.affectedRows;
}

module.exports = { evaluarSeleccion, resultadoDesdeEvento, liquidarEvento, suspenderEvento, resolverTicket };
