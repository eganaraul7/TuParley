'use strict';

/**
 * apuestas.service.js — reglas de negocio para armar un ticket.
 * Usado por la creación online y por la sincronización offline, para que ambas
 * calculen cuotas y validen eventos exactamente igual (nunca se confía en las
 * cuotas que envía el cliente).
 */

const env = require('../config/env');

class ErrorApuesta extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra  = extra;
  }
}

// Límites desde configuracion_sistema (editable por admin) con respaldo en .env
async function obtenerLimites(conn) {
  const [rows] = await conn.query(
    `SELECT clave, valor FROM configuracion_sistema
      WHERE clave IN ('max_ganancia_usd','apuesta_minima_usd','horas_vencimiento_premio')`
  );
  const cfg = Object.fromEntries(rows.map((r) => [r.clave, parseFloat(r.valor)]));
  return {
    maxGananciaUsd: cfg.max_ganancia_usd         || env.GANANCIA_MAXIMA_USD,
    apuestaMinUsd:  cfg.apuesta_minima_usd       || env.APUESTA_MINIMA_USD,
    horasVence:     cfg.horas_vencimiento_premio || 48,
  };
}

const enteroONull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * Valida las selecciones contra la BD y calcula la cuota combinada.
 * @returns {{ selecciones: object[], cuotaCombinada: number }}
 * @throws {ErrorApuesta}
 */
async function validarSelecciones(conn, selecciones) {
  if (!Array.isArray(selecciones) || selecciones.length === 0)
    throw new ErrorApuesta(400, 'Se requiere al menos una selección');
  if (selecciones.length > 20)
    throw new ErrorApuesta(400, 'Máximo 20 selecciones por ticket');

  const ids = selecciones.map((s) => Number(s?.evento_id));
  if (new Set(ids).size !== ids.length)
    throw new ErrorApuesta(400, 'No puedes incluir el mismo evento dos veces en un ticket');

  let cuotaCombinada = 1;
  const resultado = [];

  for (const sel of selecciones) {
    const evento_id    = Number(sel?.evento_id);
    const modalidad_id = Number(sel?.modalidad_id);
    if (!Number.isInteger(evento_id) || !Number.isInteger(modalidad_id))
      throw new ErrorApuesta(400, 'Cada selección necesita evento_id y modalidad_id');

    const [[evento]] = await conn.query(
      `SELECT e.id, e.deporte, e.estado, e.activo, e.tipo_fase,
              e.equipo_local, e.equipo_visitante,
              e.fecha_inicio > NOW()   AS por_iniciar,
              cc.activa                AS categoria_activa,
              COALESCE(tc.activo, 1)   AS torneo_activo
         FROM eventos e
         JOIN categorias_config cc ON cc.deporte = e.deporte
         LEFT JOIN torneos_config tc ON tc.deporte = e.deporte AND tc.nombre_liga = e.liga
        WHERE e.id = ? LIMIT 1`,
      [evento_id]
    );
    if (!evento) throw new ErrorApuesta(404, `Evento ${evento_id} no encontrado`);
    if (evento.estado !== 'programado' || !evento.activo || !evento.por_iniciar)
      throw new ErrorApuesta(409, `${evento.equipo_local} vs ${evento.equipo_visitante} ya no está disponible para apuestas`);
    if (!evento.categoria_activa)
      throw new ErrorApuesta(409, `La categoría ${evento.deporte} está desactivada`);
    if (!evento.torneo_activo)
      throw new ErrorApuesta(409, `El torneo de ${evento.equipo_local} vs ${evento.equipo_visitante} está desactivado`);

    const [[modalidad]] = await conn.query(
      `SELECT id, deporte, cuota_base, activa, tipo_resultado_btn FROM modalidades WHERE id = ? LIMIT 1`,
      [modalidad_id]
    );
    if (!modalidad || !modalidad.activa)
      throw new ErrorApuesta(404, `Modalidad ${modalidad_id} no disponible`);
    if (modalidad.deporte !== evento.deporte)
      throw new ErrorApuesta(400, `Modalidad ${modalidad_id} no corresponde al deporte del evento`);
    // Solo las modalidades de resultado directo (3 botones) tienen liquidación automática
    if (!modalidad.tipo_resultado_btn)
      throw new ErrorApuesta(400, `La modalidad ${modalidad_id} no está disponible para nuevas apuestas`);

    const tipo = modalidad.tipo_resultado_btn;

    // ── Marcador exacto opcional ──────────────────────────────────────────
    const ml = enteroONull(sel.marcador_local);
    const mv = enteroONull(sel.marcador_visitante);
    let cuotaMarcador = 1;
    if ((ml === null) !== (mv === null))
      throw new ErrorApuesta(400, 'El marcador requiere ambos valores');
    if (ml !== null) {
      const [[cm]] = await conn.query(
        `SELECT tipo_marcador, multiplicador FROM cuotas_marcador
          WHERE deporte = ? AND marcador_local = ? AND marcador_visitante = ? AND activo = 1 LIMIT 1`,
        [evento.deporte, ml, mv]
      );
      if (!cm) throw new ErrorApuesta(400, `Marcador ${ml}-${mv} no disponible para ${evento.deporte}`);
      if (cm.tipo_marcador === 'exacto') {
        const coherente = (tipo === 'local' && ml > mv) || (tipo === 'visitante' && ml < mv) || (tipo === 'empate' && ml === mv);
        if (!coherente) throw new ErrorApuesta(400, `El marcador ${ml}-${mv} no corresponde a la selección`);
      } else if (tipo === 'empate') {
        throw new ErrorApuesta(400, 'El rango de diferencia no aplica a empate');
      }
      cuotaMarcador = parseFloat(cm.multiplicador);
    }

    // ── Detalle de fin opcional ───────────────────────────────────────────
    const detalle = sel.detalle_fin || null;
    let cuotaDetalle = 1;
    if (detalle) {
      const permitido =
        (evento.deporte === 'futbol' && tipo === 'empate' && evento.tipo_fase === 'eliminatoria') ||
        (evento.deporte === 'mma' && tipo !== 'empate');
      if (!permitido) throw new ErrorApuesta(400, 'El detalle de fin no aplica a esta selección');
      const [[cd]] = await conn.query(
        `SELECT multiplicador FROM cuotas_detalle_fin
          WHERE deporte = ? AND tipo_detalle = ? AND activo = 1 LIMIT 1`,
        [evento.deporte, detalle]
      );
      if (!cd) throw new ErrorApuesta(400, `Detalle ${detalle} no disponible`);
      cuotaDetalle = parseFloat(cd.multiplicador);
    }

    const cuotaBase = parseFloat(modalidad.cuota_base);
    cuotaCombinada = Math.round(cuotaCombinada * cuotaBase * cuotaMarcador * cuotaDetalle * 10000) / 10000;

    resultado.push({
      evento_id,
      modalidad_id,
      tipo_resultado:     tipo,
      seleccion:          tipo === 'local' ? evento.equipo_local : tipo === 'visitante' ? evento.equipo_visitante : 'Empate',
      marcador_local:     ml,
      marcador_visitante: mv,
      detalle_fin:        detalle,
      cuota_aplicada:     cuotaBase,
      cuota_marcador:     cuotaMarcador,
      cuota_detalle:      cuotaDetalle,
    });
  }

  return { selecciones: resultado, cuotaCombinada };
}

// Inserta las selecciones de un ticket ya creado
async function insertarSelecciones(conn, ticketId, selecciones) {
  for (const s of selecciones) {
    await conn.query(
      `INSERT INTO selecciones_ticket
          (ticket_id, evento_id, modalidad_id, cuota_aplicada, seleccion, tipo_resultado,
           marcador_local, marcador_visitante, detalle_fin, cuota_marcador, cuota_detalle, resultado)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'pendiente')`,
      [ticketId, s.evento_id, s.modalidad_id, s.cuota_aplicada, s.seleccion, s.tipo_resultado,
        s.marcador_local, s.marcador_visitante, s.detalle_fin, s.cuota_marcador, s.cuota_detalle]
    );
  }
}

const calcularGanancia = (montoUsd, cuota) => Math.round(montoUsd * cuota * 100) / 100;

module.exports = { ErrorApuesta, obtenerLimites, validarSelecciones, insertarSelecciones, calcularGanancia };
