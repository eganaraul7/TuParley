// Nombre de archivo: deportes.service.js
// Ruta: backend/src/services/deportes.service.js
// Función: Sincroniza eventos deportivos desde APIs externas, actualiza resultados y dispara la liquidación

'use strict';
const axios     = require('axios');
const { query } = require('../config/db');
const { redis } = require('../config/redis');
const env       = require('../config/env');
const { traducirEvento } = require('./traduccion.service');
const { liquidarEvento, suspenderEvento } = require('./liquidacion.service');
const { hoyVET, sumarDias, TZ } = require('../utils/fecha');
const { resultadoApi }          = require('./resultadosApi');

// ── Configuración por deporte ─────────────────────────────────────────────────
// duracionMin: tiempo mínimo desde el inicio antes de consultar el resultado
// (evita gastar peticiones del plan gratuito en partidos que no pueden haber terminado).
const DEPORTES_CONFIG = {
  futbol: {
    url:         env.API_SPORTS_URL_FUTBOL,
    key:         env.API_SPORTS_KEY,
    endpoint:    '/fixtures',
    tipo:        'apisports',
    duracionMin: 110,
  },
  baloncesto: {
    url:         env.API_SPORTS_URL_BALONCESTO,
    key:         env.API_SPORTS_KEY,
    endpoint:    '/games',
    tipo:        'apisports',
    duracionMin: 130,
  },
  beisbol: {
    url:         env.API_SPORTS_URL_BEISBOL,
    key:         env.API_SPORTS_KEY,
    endpoint:    '/games',
    tipo:        'apisports',
    duracionMin: 170,
  },
  mma: {
    url:         env.API_SPORTS_URL_MMA,
    key:         env.API_SPORTS_KEY,
    endpoint:    '/fights',
    tipo:        'apisports',
    duracionMin: 30,
  },
  tenis: {
    url:         env.API_SPORTS_URL_TENIS,
    key:         env.API_TENNIS_KEY,
    endpoint:    '/fixtures',
    tipo:        'rapidapi',
    duracionMin: null,   // sin resultados automáticos: se registran a mano
  },
};

const DIAS_SYNC     = Math.min(7, Math.max(1, parseInt(process.env.DEPORTES_DIAS_SYNC || '7', 10)));
// Planes gratuitos: ~100 peticiones/día por API. Se deja margen.
const LIMITE_DIARIO = parseInt(process.env.API_LIMITE_DIARIO || '90', 10);

// ── Control de cuota diaria (Redis) ───────────────────────────────────────────
async function _reservarPeticion(deporte) {
  const key = `api:uso:${deporte}:${hoyVET()}`;
  try {
    const usadas = await redis.incr(key);
    if (usadas === 1) await redis.expire(key, 2 * 86400);
    if (usadas > LIMITE_DIARIO) {
      if (usadas === LIMITE_DIARIO + 1) console.warn(`[deportes/${deporte}] Límite diario de ${LIMITE_DIARIO} peticiones alcanzado`);
      return false;
    }
  } catch {
    // Sin Redis no se bloquea la petición
  }
  return true;
}

async function _get(deporte, config, params) {
  if (!config.key) throw new Error('API key no configurada');
  if (!(await _reservarPeticion(deporte))) throw new Error('límite diario de peticiones alcanzado');
  const headers = config.tipo === 'rapidapi'
    ? { 'x-rapidapi-key': config.key, 'x-rapidapi-host': new URL(config.url).host }
    : { 'x-apisports-key': config.key };
  const res = await axios.get(`${config.url}${config.endpoint}`, { headers, params, timeout: 10000 });
  // API-Sports responde 200 con { errors: {...} } ante clave inválida o plan insuficiente
  const errores = res.data?.errors;
  if (errores && (Array.isArray(errores) ? errores.length : Object.keys(errores).length)) {
    throw new Error(`API: ${JSON.stringify(errores)}`);
  }
  return res.data;
}

// ── Normalizadores ────────────────────────────────────────────────────────────

function _normalizarApisports(f, deporte) {
  const api_evento_id = String(f.fixture?.id ?? f.fight?.id ?? f.id ?? '');
  const liga          = f.league?.name ?? f.competition?.name ?? (deporte === 'mma' ? (f.event?.name ?? 'MMA') : 'Liga');
  const equipoLocal   = f.teams?.home?.name ?? f.fighters?.home?.name ?? f.fighters?.first?.name ?? '';
  const equipoVisit   = f.teams?.away?.name ?? f.fighters?.away?.name ?? f.fighters?.second?.name ?? '';
  const fechaStr      = f.fixture?.date ?? f.fight?.date ?? f.date ?? null;
  return traducirEvento({ api_evento_id, deporte, liga, equipoLocal, equipoVisit, fechaStr });
}

function _normalizarTenis(f) {
  const api_evento_id = String(f.event_key ?? f.id ?? '');
  const liga          = f.tournament_name ?? f.league_name ?? 'Torneo';
  const equipoLocal   = f.event_first_player  ?? f.home_player  ?? '';
  const equipoVisit   = f.event_second_player ?? f.away_player  ?? '';
  // Sin zona horaria explícita la API devuelve hora local del torneo; se asume VET (-04:00)
  const fechaStr      = f.event_date
    ? `${f.event_date}T${f.event_time ?? '00:00'}:00-04:00`
    : null;
  return traducirEvento({ api_evento_id, deporte: 'tenis', liga, equipoLocal, equipoVisit, fechaStr });
}

// ── Fetch de un día ───────────────────────────────────────────────────────────
async function _fetchDia(deporte, config, fecha) {
  if (config.tipo === 'rapidapi') {
    const data = await _get(deporte, config, { date: fecha });
    const matches = data?.result ?? data?.response ?? [];
    return Array.isArray(matches) ? matches : [];
  }
  const data = await _get(deporte, config, { date: fecha, timezone: TZ });
  return data?.response ?? [];
}

// ── Sincronizar eventos de los próximos días ─────────────────────────────────
async function sincronizarEventosSemana() {
  const resultados = { creados: 0, actualizados: 0, errores: [] };
  const hoy = hoyVET();

  for (const [deporte, config] of Object.entries(DEPORTES_CONFIG)) {
    const crudos = [];
    for (let i = 0; i < DIAS_SYNC; i++) {
      const fecha = sumarDias(hoy, i);
      try {
        crudos.push(...await _fetchDia(deporte, config, fecha));
      } catch (err) {
        resultados.errores.push({ deporte, fecha, error: err.message });
        if (/límite diario|API key no configurada|401|403/.test(err.message)) break;
      }
    }
    const eventos = crudos.map((f) => (config.tipo === 'rapidapi' ? _normalizarTenis(f) : _normalizarApisports(f, deporte)));

    try {
      for (const ev of eventos) {
        const { api_evento_id, liga, equipoLocal, equipoVisit, fechaStr } = ev;
        if (!api_evento_id || !equipoLocal || !equipoVisit) continue;
        const fechaInicio = new Date(fechaStr);
        if (isNaN(fechaInicio.getTime())) continue;

        const existe = await query(
          `SELECT id, estado FROM eventos WHERE deporte = ? AND api_evento_id = ? LIMIT 1`, [deporte, api_evento_id]
        );
        if (existe.length === 0) {
          await query(
            `INSERT INTO eventos
              (api_evento_id, deporte, liga, equipo_local, equipo_visitante, fecha_inicio, estado, activo)
              VALUES (?,?,?,?,?,?,'programado',1)`,
            [api_evento_id, deporte, liga, equipoLocal, equipoVisit, fechaInicio]
          );
          resultados.creados++;
        } else if (existe[0].estado === 'programado') {
          // Solo se actualizan eventos que aún no empezaron (no tocar los ya apostados en curso)
          await query(
            `UPDATE eventos SET liga=?, equipo_local=?, equipo_visitante=?, fecha_inicio=?, updated_at=NOW()
              WHERE id=?`,
            [liga, equipoLocal, equipoVisit, fechaInicio, existe[0].id]
          );
          resultados.actualizados++;
        }
      }

      const ligas = [...new Set(eventos.map((ev) => ev.liga).filter(Boolean))];
      for (const liga of ligas) {
        await query(`INSERT IGNORE INTO torneos_config (deporte, nombre_liga, activo) VALUES (?, ?, 1)`, [deporte, liga]);
      }
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
      WHERE estado='programado' AND fecha_inicio <= NOW()`
  );
  return result.affectedRows;
}

// ── Actualizar resultados de eventos en curso ─────────────────────────────────
// Una petición por deporte y día (no una por evento), solo para eventos que ya
// deberían haber terminado y que provienen de la API.
async function actualizarResultados() {
  const resumen = { finalizados: 0, suspendidos: 0, errores: [] };

  for (const [deporte, config] of Object.entries(DEPORTES_CONFIG)) {
    if (!config.duracionMin || config.tipo !== 'apisports') continue;

    const candidatos = await query(
      `SELECT id, api_evento_id, DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS dia
         FROM eventos
        WHERE deporte = ? AND estado = 'en_curso' AND api_evento_id IS NOT NULL
          AND fecha_inicio <= NOW() - INTERVAL ? MINUTE
          AND fecha_inicio >= NOW() - INTERVAL 3 DAY`,
      [deporte, config.duracionMin]
    );
    if (candidatos.length === 0) continue;

    const porDia = new Map();
    for (const c of candidatos) {
      if (!porDia.has(c.dia)) porDia.set(c.dia, []);
      porDia.get(c.dia).push(c);
    }

    for (const [dia, eventos] of porDia) {
      let partidos;
      try {
        partidos = await _fetchDia(deporte, config, dia);
      } catch (err) {
        resumen.errores.push({ deporte, dia, error: err.message });
        continue;
      }
      const porId = new Map(partidos.map((f) => [String(f.fixture?.id ?? f.fight?.id ?? f.id), f]));

      for (const ev of eventos) {
        const f = porId.get(String(ev.api_evento_id));
        if (!f) continue;
        const r = resultadoApi(deporte, f);
        if (!r) continue;
        try {
          if (r.suspendido) {
            await suspenderEvento(ev.id, 'suspendido');
            resumen.suspendidos++;
          } else {
            await query(
              `UPDATE eventos SET estado='finalizado', resultado_final=?, ganador_final=?,
                      detalle_fin_final=?, updated_at=NOW()
                WHERE id=? AND estado='en_curso'`,
              [r.gl !== null && r.gv !== null ? `${r.gl}-${r.gv}` : null, r.ganador,
                r.detalle && r.detalle !== 'ninguno' ? r.detalle : null, ev.id]
            );
            await liquidarEvento(ev.id);
            resumen.finalizados++;
          }
        } catch (err) {
          resumen.errores.push({ deporte, evento_id: ev.id, error: err.message });
        }
      }
    }
  }
  return resumen;
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
