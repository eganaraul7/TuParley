'use strict';
const axios          = require('axios');
const { query }      = require('../config/db');
const { API_SPORTS_KEY, API_SPORTS_BASE_URL } = require('../config/env');

const DEPORTE_MAP = {
  soccer:      'futbol',
  basketball:  'baloncesto',
  baseball:    'beisbol',
  tennis:      'tenis',
  horseracing: 'caballos',
};

async function _notificar(mensaje) {
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol) VALUES ('evento_suspendido', ?, 'ambos')`,
    [mensaje]
  );
}

async function sincronizarEventosSemana() {
  const resultados = { creados: 0, actualizados: 0, errores: [] };
  const deportes   = Object.keys(DEPORTE_MAP);

  for (const deporte of deportes) {
    try {
      const res = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
        headers: { 'x-apisports-key': API_SPORTS_KEY },
        params:  { sport: deporte, next: 7 },
        timeout: 10000,
      });

      const fixtures = res.data?.response ?? [];
      for (const f of fixtures) {
        const deporteLocal  = DEPORTE_MAP[deporte];
        const api_evento_id = String(f.fixture?.id ?? f.id ?? '');
        const liga          = f.league?.name ?? f.competition?.name ?? 'Liga';
        const equipoLocal   = f.teams?.home?.name ?? f.home ?? '';
        const equipoVisit   = f.teams?.away?.name ?? f.away ?? '';
        const fechaInicio   = new Date(f.fixture?.date ?? f.date);

        if (!api_evento_id || !equipoLocal || !equipoVisit) continue;

        const existe = await query(
          `SELECT id FROM eventos WHERE api_evento_id = ? LIMIT 1`, [api_evento_id]
        );
        if (existe.length === 0) {
          await query(
            `INSERT INTO eventos (api_evento_id, deporte, liga, equipo_local, equipo_visitante, fecha_inicio, estado, activo)
              VALUES (?,?,?,?,?,?,'programado',1)`,
            [api_evento_id, deporteLocal, liga, equipoLocal, equipoVisit, fechaInicio]
          );
          resultados.creados++;
        } else {
          await query(
            `UPDATE eventos SET liga = ?, equipo_local = ?, equipo_visitante = ?,
                fecha_inicio = ?, updated_at = NOW() WHERE api_evento_id = ?`,
            [liga, equipoLocal, equipoVisit, fechaInicio, api_evento_id]
          );
          resultados.actualizados++;
        }
      }
    } catch (err) {
      resultados.errores.push({ deporte, error: err.message });
    }
  }
  return resultados;
}

async function cerrarApuestasEventosIniciados() {
  const result = await query(
    `UPDATE eventos SET estado = 'en_curso', updated_at = NOW()
      WHERE estado = 'programado' AND fecha_inicio <= NOW() AND activo = 1`
  );
  return result.affectedRows;
}

async function actualizarResultados() {
  const eventosEnCurso = await query(
    `SELECT id, api_evento_id, deporte FROM eventos WHERE estado = 'en_curso' AND activo = 1`
  );

  for (const evento of eventosEnCurso) {
    try {
      const res = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
        headers: { 'x-apisports-key': API_SPORTS_KEY },
        params:  { id: evento.api_evento_id },
        timeout: 10000,
      });

      const f      = res.data?.response?.[0];
      if (!f) continue;

      const status = f.fixture?.status?.short ?? f.status ?? '';
      const golesH = f.goals?.home ?? f.score?.home ?? null;
      const golesA = f.goals?.away ?? f.score?.away ?? null;

      if (['FT', 'AET', 'PEN', 'FIN'].includes(status)) {
        const resultado = golesH !== null ? `${golesH}-${golesA}` : 'FIN';
        await query(
          `UPDATE eventos SET estado = 'finalizado', resultado_final = ?, updated_at = NOW()
            WHERE id = ?`, [resultado, evento.id]
        );
        await _resolverTicketsEvento(evento.id, resultado);
      } else if (['CANC', 'PST', 'SUSP', 'ABD'].includes(status)) {
        await query(
          `UPDATE eventos SET estado = 'suspendido', updated_at = NOW() WHERE id = ?`, [evento.id]
        );
        await _suspenderTicketsEvento(evento.id);
      }
    } catch { /* continuar con siguiente */ }
  }
}

async function _resolverTicketsEvento(evento_id, resultado) {
  const selecciones = await query(
    `SELECT st.id, st.ticket_id, st.seleccion, st.modalidad_id
        FROM selecciones_ticket st
        JOIN tickets t ON t.id = st.ticket_id
      WHERE st.evento_id = ? AND t.estado = 'PENDIENTE' AND st.resultado = 'pendiente'`,
    [evento_id]
  );

  for (const sel of selecciones) {
    const gano = _evaluarSeleccion(sel.seleccion, resultado);
    await query(
      `UPDATE selecciones_ticket SET resultado = ? WHERE id = ?`,
      [gano ? 'ganado' : 'perdido', sel.id]
    );
  }

  // Evaluar tickets completos
  const tickets = [...new Set(selecciones.map(s => s.ticket_id))];
  for (const ticket_id of tickets) {
    const todasSelecciones = await query(
      `SELECT resultado FROM selecciones_ticket WHERE ticket_id = ?`, [ticket_id]
    );
    const haySuspendida = todasSelecciones.some(s => s.resultado === 'suspendido');
    const hayPendiente  = todasSelecciones.some(s => s.resultado === 'pendiente');
    const hayPerdida    = todasSelecciones.some(s => s.resultado === 'perdido');
    const todasGanadas  = todasSelecciones.every(s => s.resultado === 'ganado');

    if (hayPendiente || haySuspendida) continue;

    if (todasGanadas) {
      const ahora    = new Date();
      const vence    = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
      await query(
        `UPDATE tickets SET estado = 'GANADO', fecha_estado_ganado = ?,
            fecha_vencimiento_cobro = ?, updated_at = NOW() WHERE id = ?`,
        [ahora, vence, ticket_id]
      );
      await query(
        `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
          SELECT 'ticket_ganador',
                CONCAT('Ticket ', numero_serie, ' marcado como GANADO — $', ganancia_potencial_usd),
                'ambos', id, 'tickets' FROM tickets WHERE id = ?`, [ticket_id]
      );
    } else if (hayPerdida) {
      await query(
        `UPDATE tickets SET estado = 'PERDIDO', updated_at = NOW() WHERE id = ?`, [ticket_id]
      );
    }
  }
}

function _evaluarSeleccion(seleccion, resultado) {
  // Lógica básica: la seleccion contiene el equipo/resultado ganador esperado
  // El resultado viene como "2-1" (local-visitante)
  if (!resultado || resultado === 'FIN') return false;
  const [gl, gv] = resultado.split('-').map(Number);
  const s = String(seleccion).toLowerCase();

  if (s === '1' || s === 'local')    return gl > gv;
  if (s === '2' || s === 'visitante')return gv > gl;
  if (s === 'x' || s === 'empate')   return gl === gv;
  if (s.startsWith('over_'))         { const ref = parseFloat(s.split('_')[1]); return (gl + gv) > ref; }
  if (s.startsWith('under_'))        { const ref = parseFloat(s.split('_')[1]); return (gl + gv) < ref; }
  return false;
}

async function _suspenderTicketsEvento(evento_id) {
  await query(
    `UPDATE selecciones_ticket SET resultado = 'suspendido'
      WHERE evento_id = ?`, [evento_id]
  );
  const tickets = await query(
    `SELECT DISTINCT ticket_id FROM selecciones_ticket WHERE evento_id = ?`, [evento_id]
  );
  for (const { ticket_id } of tickets) {
    await query(
      `UPDATE tickets SET estado = 'SUSPENDIDO', updated_at = NOW()
        WHERE id = ? AND estado = 'PENDIENTE'`, [ticket_id]
    );
  }
  await _notificar(`Evento ID ${evento_id} suspendido. Tickets afectados: ${tickets.length}`);
}

async function obtenerMarcadoresEnVivo() {
  const eventos = await query(
    `SELECT id, api_evento_id, deporte, liga, equipo_local, equipo_visitante,
            fecha_inicio, resultado_final
        FROM eventos WHERE estado = 'en_curso'`
  );
  return eventos;
}

module.exports = {
  sincronizarEventosSemana,
  cerrarApuestasEventosIniciados,
  actualizarResultados,
  obtenerMarcadoresEnVivo,
};