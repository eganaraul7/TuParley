// Nombre de archivo: deportes.service.js
// Ruta: backend/src/services/deportes.service.js
// Función: Sincroniza eventos deportivos desde APIs externas, resuelve tickets y actualiza resultados

'use strict';
const axios     = require('axios');
const { query } = require('../config/db');
const env       = require('../config/env');
const { traducirEvento } = require('./traduccion.service');

// ── Configuración por deporte ─────────────────────────────────────────────────
const DEPORTES_CONFIG = {
  futbol: {
    url:      env.API_SPORTS_URL_FUTBOL,
    key:      env.API_SPORTS_KEY,
    endpoint: '/fixtures',
    tipo:     'apisports',
  },
  baloncesto: {
    url:      env.API_SPORTS_URL_BALONCESTO,
    key:      env.API_SPORTS_KEY,
    endpoint: '/games',
    tipo:     'apisports',
  },
  beisbol: {
    url:      env.API_SPORTS_URL_BEISBOL,
    key:      env.API_SPORTS_KEY,
    endpoint: '/games',
    tipo:     'apisports',
  },
  mma: {
    url:      env.API_SPORTS_URL_MMA,
    key:      env.API_SPORTS_KEY,
    endpoint: '/fights',
    tipo:     'apisports',
  },
  tenis: {
    url:      env.API_SPORTS_URL_TENIS,
    key:      env.API_TENNIS_KEY,
    endpoint: '/fixtures',   // ← era '/matches'
    tipo:     'rapidapi',
  },
};

// ── Normalizadores ────────────────────────────────────────────────────────────

function _normalizarApisports(f, deporte) {
  const api_evento_id = String(f.fixture?.id ?? f.fight?.id ?? f.id ?? '');
  const liga          = f.league?.name ?? f.competition?.name ?? 'Liga';
  const equipoLocal   = f.teams?.home?.name ?? f.fighters?.home?.name ?? '';
  const equipoVisit   = f.teams?.away?.name ?? f.fighters?.away?.name ?? '';
  const fechaStr      = f.fixture?.date ?? f.fight?.date ?? f.date ?? null;
  return traducirEvento({ api_evento_id, deporte, liga, equipoLocal, equipoVisit, fechaStr });
}

function _normalizarMMA(f) {
  const api_evento_id = String(f.fight?.id ?? f.id ?? '');
  const liga          = f.league?.name ?? f.event?.name ?? 'MMA';
  const equipoLocal   = f.fighters?.home?.name ?? f.fighter_1?.name ?? '';
  const equipoVisit   = f.fighters?.away?.name ?? f.fighter_2?.name ?? '';
  const fechaStr      = f.fight?.date ?? f.date ?? null;
  return traducirEvento({ api_evento_id, deporte: 'mma', liga, equipoLocal, equipoVisit, fechaStr });
}

function _normalizarTenis(f) {
  const api_evento_id = String(f.event_key ?? f.id ?? '');
  const liga          = f.tournament_name ?? f.league_name ?? 'Torneo';
  const equipoLocal   = f.event_first_player  ?? f.home_player  ?? '';
  const equipoVisit   = f.event_second_player ?? f.away_player  ?? '';
  const fechaStr      = f.event_date
    ? `${f.event_date}T${f.event_time ?? '00:00'}:00`
    : null;
  return traducirEvento({ api_evento_id, deporte: 'tenis', liga, equipoLocal, equipoVisit, fechaStr });
}

// ── Fetch por deporte ─────────────────────────────────────────────────────────

async function _fetchDeporte(deporte, config) {
  if (config.tipo === 'rapidapi') {
    const todasLasFixtures = [];
    for (let i = 0; i < 7; i++) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];
      try {
        const res = await axios.get(`${config.url}${config.endpoint}`, {
          headers: {
            'x-rapidapi-key':  config.key,
            'x-rapidapi-host': 'api-tennis.p.rapidapi.com',
          },
          params:  { date: fechaStr },
          timeout: 10000,
        });
        const matches = res.data?.result ?? res.data?.response ?? [];
        if (Array.isArray(matches)) todasLasFixtures.push(...matches);
      } catch (err) {
        console.warn(`[deportes/tenis] Error fecha ${fechaStr}:`, err.message);
      }
    }
    return todasLasFixtures.map(_normalizarTenis);
  }

  // apisports — consultar día por día
  const todasLasFixtures = [];
  for (let i = 0; i < 7; i++) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + i);
    const fechaStr = fecha.toISOString().split('T')[0];
    try {
      const res = await axios.get(`${config.url}${config.endpoint}`, {
        headers: { 'x-apisports-key': config.key },
        params:  { date: fechaStr },
        timeout: 10000,
      });
      const fixtures = res.data?.response ?? [];
      todasLasFixtures.push(...fixtures);
    } catch (err) {
      console.warn(`[deportes/${deporte}] Error fecha ${fechaStr}:`, err.message);
    }
  }

  if (deporte === 'mma') return todasLasFixtures.map(_normalizarMMA);
  return todasLasFixtures.map(f => _normalizarApisports(f, deporte));
}

// ── Auto-registro de torneos nuevos ──────────────────────────────────────────

async function _registrarTorneosNuevos(deporte, eventos) {
  const ligasUnicas = [...new Set(eventos.map(ev => ev.liga).filter(Boolean))];
  for (const liga of ligasUnicas) {
    await query(
      `INSERT IGNORE INTO torneos_config (deporte, nombre_liga, activo) VALUES (?, ?, 1)`,
      [deporte, liga]
    );
  }
}

// ── Sincronizar eventos semana ────────────────────────────────────────────────

async function sincronizarEventosSemana() {
  const resultados = { creados: 0, actualizados: 0, errores: [] };

  for (const [deporte, config] of Object.entries(DEPORTES_CONFIG)) {
    try {
      const eventos = await _fetchDeporte(deporte, config);

      for (const ev of eventos) {
        const { api_evento_id, liga, equipoLocal, equipoVisit, fechaStr } = ev;
        if (!api_evento_id || !equipoLocal || !equipoVisit) continue;
        const fechaInicio = new Date(fechaStr);
        if (isNaN(fechaInicio.getTime())) continue;

        const existe = await query(
          `SELECT id FROM eventos WHERE api_evento_id = ? LIMIT 1`, [api_evento_id]
        );
        if (existe.length === 0) {
          await query(
            `INSERT INTO eventos
              (api_evento_id, deporte, liga, equipo_local, equipo_visitante, fecha_inicio, estado, activo)
              VALUES (?,?,?,?,?,?,'programado',1)`,
            [api_evento_id, deporte, liga, equipoLocal, equipoVisit, fechaInicio]
          );
          resultados.creados++;
        } else {
          await query(
            `UPDATE eventos SET liga=?, equipo_local=?, equipo_visitante=?,
              fecha_inicio=?, updated_at=NOW() WHERE api_evento_id=?`,
            [liga, equipoLocal, equipoVisit, fechaInicio, api_evento_id]
          );
          resultados.actualizados++;
        }
      }

      await _registrarTorneosNuevos(deporte, eventos);

    } catch (err) {
      resultados.errores.push({ deporte, error: err.message });
    }
  }
  return resultados;
}

// ── Cierre automático de apuestas al iniciar el evento ────────────────────────

async function cerrarApuestasEventosIniciados() {
  const result = await query(
    `UPDATE eventos SET estado='en_curso', updated_at=NOW()
      WHERE estado='programado' AND fecha_inicio <= NOW() AND activo=1`
  );
  return result.affectedRows;
}

// ── Actualizar resultados de eventos en curso ─────────────────────────────────

async function actualizarResultados() {
  const eventosEnCurso = await query(
    `SELECT id, api_evento_id, deporte FROM eventos WHERE estado='en_curso' AND activo=1`
  );

  for (const evento of eventosEnCurso) {
    try {
      const config = DEPORTES_CONFIG[evento.deporte];
      if (!config || config.tipo === 'rapidapi') continue;

      const res = await axios.get(`${config.url}${config.endpoint}`, {
        headers: { 'x-apisports-key': config.key },
        params:  { id: evento.api_evento_id },
        timeout: 10000,
      });

      const f      = res.data?.response?.[0];
      if (!f) continue;

      const status = f.fixture?.status?.short ?? f.fight?.status?.short ?? f.status?.short ?? f.status ?? '';
      const golesH = f.goals?.home  ?? f.scores?.home?.total ?? f.score?.home ?? null;
      const golesA = f.goals?.away  ?? f.scores?.away?.total ?? f.score?.away ?? null;

      if (['FT','AET','PEN','FIN','AOT','END'].includes(status)) {
        const resultado = golesH !== null ? `${golesH}-${golesA}` : 'FIN';
        await query(
          `UPDATE eventos SET estado='finalizado', resultado_final=?, updated_at=NOW() WHERE id=?`,
          [resultado, evento.id]
        );
        await _resolverTicketsEvento(evento.id, resultado);
      } else if (['CANC','PST','SUSP','ABD','WO'].includes(status)) {
        await query(
          `UPDATE eventos SET estado='suspendido', updated_at=NOW() WHERE id=?`, [evento.id]
        );
        await _suspenderTicketsEvento(evento.id);
      }
    } catch { /* siguiente */ }
  }
}

// ── Resolver tickets de un evento finalizado ──────────────────────────────────

async function _resolverTicketsEvento(evento_id, resultado) {
  const selecciones = await query(
    `SELECT st.id, st.ticket_id, st.seleccion
        FROM selecciones_ticket st
        JOIN tickets t ON t.id = st.ticket_id
      WHERE st.evento_id=? AND t.estado='PENDIENTE' AND st.resultado='pendiente'`,
    [evento_id]
  );

  for (const sel of selecciones) {
    const gano = _evaluarSeleccion(sel.seleccion, resultado);
    await query(
      `UPDATE selecciones_ticket SET resultado=? WHERE id=?`,
      [gano ? 'ganado' : 'perdido', sel.id]
    );
  }

  const tickets = [...new Set(selecciones.map(s => s.ticket_id))];
  for (const ticket_id of tickets) {
    const todas = await query(
      `SELECT resultado FROM selecciones_ticket WHERE ticket_id=?`, [ticket_id]
    );
    if (todas.some(s => s.resultado === 'pendiente' || s.resultado === 'suspendido')) continue;

    if (todas.every(s => s.resultado === 'ganado')) {
      const ahora = new Date();
      const vence = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
      await query(
        `UPDATE tickets SET estado='GANADO', fecha_estado_ganado=?,
            fecha_vencimiento_cobro=?, updated_at=NOW() WHERE id=?`,
        [ahora, vence, ticket_id]
      );
      await query(
        `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
          SELECT 'ticket_ganador',
                CONCAT('Ticket ', numero_serie, ' GANADO — $', ganancia_potencial_usd),
                'ambos', id, 'tickets' FROM tickets WHERE id=?`, [ticket_id]
      );
    } else if (todas.some(s => s.resultado === 'perdido')) {
      await query(
        `UPDATE tickets SET estado='PERDIDO', updated_at=NOW() WHERE id=?`, [ticket_id]
      );
    }
  }
}

function _evaluarSeleccion(seleccion, resultado) {
  if (!resultado || resultado === 'FIN') return false;
  const partes = resultado.split('-').map(Number);
  if (partes.length < 2 || partes.some(isNaN)) return false;
  const [gl, gv] = partes;
  const s = String(seleccion).toLowerCase();
  if (s === '1' || s === 'local')     return gl > gv;
  if (s === '2' || s === 'visitante') return gv > gl;
  if (s === 'x' || s === 'empate')    return gl === gv;
  if (s.startsWith('over_'))  { const r = parseFloat(s.split('_')[1]); return (gl + gv) > r; }
  if (s.startsWith('under_')) { const r = parseFloat(s.split('_')[1]); return (gl + gv) < r; }
  return false;
}

async function _suspenderTicketsEvento(evento_id) {
  await query(
    `UPDATE selecciones_ticket SET resultado='suspendido' WHERE evento_id=?`, [evento_id]
  );
  const tickets = await query(
    `SELECT DISTINCT ticket_id FROM selecciones_ticket WHERE evento_id=?`, [evento_id]
  );
  for (const { ticket_id } of tickets) {
    await query(
      `UPDATE tickets SET estado='SUSPENDIDO', updated_at=NOW()
        WHERE id=? AND estado='PENDIENTE'`, [ticket_id]
    );
  }
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol)
      VALUES ('evento_suspendido', ?, 'ambos')`,
    [`Evento ID ${evento_id} suspendido. Tickets afectados: ${tickets.length}`]
  );
}

async function obtenerMarcadoresEnVivo() {
  return query(
    `SELECT id, api_evento_id, deporte, liga, equipo_local, equipo_visitante,
            fecha_inicio, resultado_final
        FROM eventos WHERE estado='en_curso'`
  );
}

module.exports = {
  sincronizarEventosSemana,
  cerrarApuestasEventosIniciados,
  actualizarResultados,
  obtenerMarcadoresEnVivo,
};