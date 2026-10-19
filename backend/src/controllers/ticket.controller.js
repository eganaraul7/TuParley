'use strict';

const { query, getConnection }               = require('../config/db');
const { getCache, KEYS }                     = require('../config/redis');
const { generarHashTicket, verificarHashTicket } = require('../services/hash.service');
const { paginacion }                         = require('../utils/paginacion');

async function _log(usuarioId, accion, entidad_afectada, entidad_id, detalle, ip) {
  await query(
    `INSERT INTO auditoria_logs (usuario_id, accion, entidad_afectada, entidad_id, detalle, ip_address)
      VALUES (?,?,?,?,?,?)`,
    [usuarioId ?? null, accion, entidad_afectada ?? null, entidad_id ?? null,
      detalle ? JSON.stringify(detalle) : null, ip ?? null]
  );
}

async function _notificar(tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo) {
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
      VALUES (?,?,?,?,?)`,
    [tipo, mensaje, destinatario_rol, referencia_id ?? null, referencia_tipo ?? null]
  );
}

const {
  ErrorApuesta, obtenerLimites, validarSelecciones, insertarSelecciones, calcularGanancia,
} = require('../services/apuestas.service');

function _ip(req) {
  return req.ip || '';
}

async function _obtenerTasaBcv() {
  const cached = await getCache(KEYS.BCV_TASA_ACTUAL, true);
  if (cached && cached.valor) return parseFloat(cached.valor);
  const rows = await query(
    `SELECT valor FROM tasa_bcv WHERE validada = 1 ORDER BY fecha DESC, id DESC LIMIT 1`
  );
  if (rows.length === 0) throw new ErrorApuesta(503, 'Tasa BCV no disponible. El administrador debe cargarla.');
  return parseFloat(rows[0].valor);
}

function _generarNumeroSerie(bodegaPrefijo) {
  const r4 = () => String(Math.floor(1000 + Math.random() * 9000));
  return `${bodegaPrefijo}-${r4()}-${r4()}`;
}

function _responderError(res, err, contexto) {
  if (err instanceof ErrorApuesta) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Operación duplicada' });
  console.error(`[ticket.controller] ${contexto}:`, err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

// Valida monto contra límites y devuelve los montos calculados por el servidor
function _calcularMontos(montoUsd, cuotaCombinada, tasa, limites) {
  if (!Number.isFinite(montoUsd) || montoUsd < limites.apuestaMinUsd)
    throw new ErrorApuesta(400, `Apuesta mínima es $${limites.apuestaMinUsd}`);
  const gananciaUsd = calcularGanancia(montoUsd, cuotaCombinada);
  if (gananciaUsd > limites.maxGananciaUsd) {
    const montoMax = Math.floor((limites.maxGananciaUsd / cuotaCombinada) * 100) / 100;
    throw new ErrorApuesta(400, `Ganancia excede $${limites.maxGananciaUsd}. Monto máximo: $${montoMax}`,
      { monto_maximo: montoMax, cuota_combinada: cuotaCombinada });
  }
  return {
    gananciaUsd,
    gananciaBs: Math.round(gananciaUsd * tasa * 100) / 100,
    montoBs:    Math.round(montoUsd * tasa * 100) / 100,
  };
}

// ─── POST /api/tickets ────────────────────────────────────────────────────────

async function crearTicket(req, res) {
  const { id: usuarioId, bodega_id, bodega_prefijo } = req.usuario;
  const ip = _ip(req);
  const { selecciones, monto_apostado_usd, moneda_pago } = req.body;

  if (!['USD', 'BS'].includes(moneda_pago)) {
    return res.status(400).json({ error: "moneda_pago debe ser 'USD' o 'BS'" });
  }
  if (!bodega_id || !bodega_prefijo) {
    return res.status(403).json({ error: 'El usuario no tiene bodega asignada' });
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const montoUsd = Math.round(parseFloat(monto_apostado_usd) * 100) / 100;
    const limites  = await obtenerLimites(conn);
    const tasa     = await _obtenerTasaBcv();
    const { selecciones: seleccionesValidas, cuotaCombinada } = await validarSelecciones(conn, selecciones);
    const { gananciaUsd, gananciaBs, montoBs } = _calcularMontos(montoUsd, cuotaCombinada, tasa, limites);

    let numeroSerie = null;
    for (let i = 0; i < 10 && !numeroSerie; i++) {
      const candidato = _generarNumeroSerie(bodega_prefijo);
      const [exist] = await conn.query(`SELECT id FROM tickets WHERE numero_serie = ? LIMIT 1`, [candidato]);
      if (!exist[0]) numeroSerie = candidato;
    }
    if (!numeroSerie) throw new ErrorApuesta(500, 'Error generando número de serie, reintenta');

    const ahora      = new Date();
    const hashSha256 = generarHashTicket({
      numero_serie: numeroSerie, bodega_id, usuario_id: usuarioId,
      monto_apostado_usd: montoUsd, cuota_combinada: cuotaCombinada,
      selecciones: seleccionesValidas, ts: ahora.getTime(),
    });

    const [ticketResult] = await conn.query(
      `INSERT INTO tickets
          (numero_serie, bodega_id, usuario_id, monto_apostado_usd, monto_apostado_bs,
          tasa_bcv_dia, cuota_combinada, ganancia_potencial_usd, ganancia_potencial_bs,
          estado, moneda_pago, origen, sincronizado, hash_sha256, fecha_creacion)
        VALUES (?,?,?,?,?,?,?,?,?,'PENDIENTE',?,'online',1,?,?)`,
      [numeroSerie, bodega_id, usuarioId, montoUsd, montoBs, tasa,
        cuotaCombinada, gananciaUsd, gananciaBs, moneda_pago, hashSha256, ahora]
    );
    const ticketId = ticketResult.insertId;
    await insertarSelecciones(conn, ticketId, seleccionesValidas);

    await conn.commit();

    if (gananciaUsd >= 200) {
      await _notificar('ticket_ganador',
        `Ticket ${numeroSerie} con ganancia potencial $${gananciaUsd} creado en bodega ${bodega_id}`,
        'ambos', ticketId, 'tickets');
    }
    await _log(usuarioId, 'crear_ticket', 'tickets', ticketId,
      { numeroSerie, montoUsd, cuotaCombinada, gananciaPotencialUsd: gananciaUsd, origen: 'online' }, ip);

    return res.status(201).json({
      ticket: {
        id: ticketId, numero_serie: numeroSerie,
        monto_apostado_usd: montoUsd, monto_apostado_bs: montoBs,
        tasa_bcv_dia: tasa, cuota_combinada: cuotaCombinada,
        ganancia_potencial_usd: gananciaUsd, ganancia_potencial_bs: gananciaBs,
        estado: 'PENDIENTE', moneda_pago, origen: 'online', hash_sha256: hashSha256,
        fecha_creacion: ahora, selecciones: seleccionesValidas,
      }
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return _responderError(res, err, 'crearTicket');
  } finally {
    conn.release();
  }
}

// ─── POST /api/tickets/sync-offline ──────────────────────────────────────────
// Los tickets offline se revalidan por completo: el servidor recalcula cuotas,
// exige que la bodega/usuario sean los del token y que ningún evento haya
// empezado. Si algo no cuadra se rechaza y se avisa al administrador para
// devolver el dinero al cliente.

const SERIE_RE = /^[A-Z0-9]{1,5}-\d{4}-\d{4}$/;

async function _sincronizarUno(req, t) {
  const { id: usuarioId, bodega_id, bodega_prefijo } = req.usuario;
  const { hash_sha256, numero_serie, monto_apostado_usd, cuota_combinada, selecciones, ts, moneda_pago, modo_impresion } = t ?? {};

  if (typeof numero_serie !== 'string' || !SERIE_RE.test(numero_serie) || !numero_serie.startsWith(`${bodega_prefijo}-`))
    throw new ErrorApuesta(400, 'Número de serie inválido');
  if (Number(t.bodega_id) !== Number(bodega_id) || Number(t.usuario_id) !== Number(usuarioId))
    throw new ErrorApuesta(403, 'El ticket no pertenece a este usuario/bodega');
  if (!verificarHashTicket({ numero_serie, bodega_id: t.bodega_id, usuario_id: t.usuario_id,
    monto_apostado_usd, cuota_combinada, selecciones, ts }, hash_sha256))
    throw new ErrorApuesta(400, 'Hash inválido');

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || tsNum > Date.now() + 5 * 60000 || tsNum < Date.now() - 48 * 3600000)
    throw new ErrorApuesta(400, 'Fecha del ticket fuera de rango');
  const moneda = ['USD', 'BS'].includes(moneda_pago) ? moneda_pago : 'USD';

  const existe = await query(`SELECT id FROM tickets WHERE numero_serie = ? LIMIT 1`, [numero_serie]);
  if (existe.length > 0) return { estado: 'ya_existe', ticket_id: existe[0].id };

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const montoUsd = Math.round(parseFloat(monto_apostado_usd) * 100) / 100;
    const limites  = await obtenerLimites(conn);
    const tasa     = await _obtenerTasaBcv();
    const { selecciones: seleccionesValidas, cuotaCombinada } = await validarSelecciones(conn, selecciones);
    if (Math.abs(cuotaCombinada - Number(cuota_combinada)) > 0.001)
      throw new ErrorApuesta(409, `La cuota cambió (impresa ${Number(cuota_combinada).toFixed(2)}, vigente ${cuotaCombinada.toFixed(2)})`);
    const { gananciaUsd, gananciaBs, montoBs } = _calcularMontos(montoUsd, cuotaCombinada, tasa, limites);

    const [result] = await conn.query(
      `INSERT INTO tickets
          (numero_serie, bodega_id, usuario_id, monto_apostado_usd, monto_apostado_bs,
          tasa_bcv_dia, cuota_combinada, ganancia_potencial_usd, ganancia_potencial_bs,
          estado, moneda_pago, modo_impresion, origen, sincronizado, hash_sha256, fecha_creacion)
        VALUES (?,?,?,?,?,?,?,?,?,'PENDIENTE',?,?,'offline',1,?,?)`,
      [numero_serie, bodega_id, usuarioId, montoUsd, montoBs, tasa,
        cuotaCombinada, gananciaUsd, gananciaBs, moneda,
        ['fisica', 'digital'].includes(modo_impresion) ? modo_impresion : null,
        hash_sha256, new Date(tsNum)]
    );
    await insertarSelecciones(conn, result.insertId, seleccionesValidas);
    await conn.commit();
    return { estado: 'sincronizado', ticket_id: result.insertId };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function sincronizarOffline(req, res) {
  const { cola } = req.body;
  if (!Array.isArray(cola) || cola.length === 0) {
    return res.status(400).json({ error: 'cola debe ser un arreglo no vacío' });
  }
  if (cola.length > 100) {
    return res.status(400).json({ error: 'Máximo 100 tickets por sincronización' });
  }

  const resultados = [];
  for (const ticketOffline of cola) {
    const numero_serie = ticketOffline?.numero_serie ?? null;
    try {
      const r = await _sincronizarUno(req, ticketOffline);
      resultados.push({ numero_serie, ...r });
      if (r.estado === 'sincronizado')
        await _log(req.usuario.id, 'sync_offline_ok', 'tickets', r.ticket_id, { numero_serie }, _ip(req));
    } catch (err) {
      if (!(err instanceof ErrorApuesta) && err?.code !== 'ER_DUP_ENTRY') {
        console.error('[ticket.controller] sincronizarOffline:', err);
        resultados.push({ numero_serie, estado: 'error', motivo: 'Error interno, se reintentará' });
        continue;
      }
      const motivo = err.code === 'ER_DUP_ENTRY' ? 'Ticket duplicado' : err.message;
      resultados.push({ numero_serie, estado: 'rechazado', motivo });
      await _log(req.usuario.id, 'sync_offline_rechazado', 'tickets', null, { numero_serie, motivo }, _ip(req));
      await _notificar('ticket_offline_rechazado',
        `Ticket offline ${numero_serie ?? '(sin serie)'} de "${req.usuario.nombre_usuario}" rechazado: ${motivo}. Devolver el dinero al cliente.`,
        'ambos', null, 'tickets');
    }
  }

  return res.status(200).json({ resultados });
}

// ─── GET /api/tickets ─────────────────────────────────────────────────────────

async function listarTickets(req, res) {
  const { rol, bodega_id } = req.usuario;
  const { estado, fecha_desde, fecha_hasta, serie } = req.query;
  const { page, limit, sql: limitSql } = paginacion(req.query);

  try {
    let where = ' WHERE 1=1';
    const params = [];

    if (rol === 'bodeguero') { where += ' AND t.bodega_id = ?'; params.push(bodega_id); }
    if (estado)      { where += ' AND t.estado = ?';                params.push(estado); }
    if (fecha_desde) { where += ' AND DATE(t.fecha_creacion) >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { where += ' AND DATE(t.fecha_creacion) <= ?'; params.push(fecha_hasta); }
    if (serie)       { where += ' AND t.numero_serie LIKE ?';       params.push(`%${String(serie).trim()}%`); }

    const tickets = await query(
      `SELECT t.id, t.numero_serie, t.bodega_id, t.usuario_id,
              t.monto_apostado_usd, t.monto_apostado_bs, t.tasa_bcv_dia,
              t.cuota_combinada, t.ganancia_potencial_usd, t.ganancia_potencial_bs,
              t.estado, t.modo_impresion, t.moneda_pago, t.origen, t.fecha_creacion,
              t.fecha_estado_ganado, t.fecha_vencimiento_cobro,
              b.nombre AS bodega_nombre, u.nombre_usuario
         FROM tickets t
         JOIN bodegas b ON b.id = t.bodega_id
         JOIN usuarios u ON u.id = t.usuario_id
       ${where}
        ORDER BY t.fecha_creacion DESC${limitSql}`,
      params
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM tickets t${where}`, params);
    return res.status(200).json({ tickets, total, page, limit });
  } catch (err) {
    console.error('[ticket.controller] listarTickets:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/tickets/buscar ──────────────────────────────────────────────────

async function buscarTicketPorSerie(req, res) {
  const { serie }          = req.query;
  const { rol, bodega_id } = req.usuario;
  if (!serie) return res.status(400).json({ error: 'Parámetro serie requerido' });

  try {
    const rows = await query(
      `SELECT t.*, b.nombre AS bodega_nombre, u.nombre_usuario
          FROM tickets t
          JOIN bodegas b ON b.id = t.bodega_id
          JOIN usuarios u ON u.id = t.usuario_id
        WHERE t.numero_serie = ? LIMIT 1`,
      [serie]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

    const ticket = rows[0];
    if (rol === 'bodeguero' && ticket.bodega_id !== bodega_id) {
      return res.status(403).json({ error: 'No tienes acceso a este ticket' });
    }

    const selecciones = await query(
      `SELECT st.*, e.equipo_local, e.equipo_visitante, e.liga, e.deporte,
              e.fecha_inicio, e.estado AS evento_estado,
              m.nombre AS modalidad_nombre, m.descripcion AS modalidad_descripcion
          FROM selecciones_ticket st
          JOIN eventos e ON e.id = st.evento_id
          JOIN modalidades m ON m.id = st.modalidad_id
        WHERE st.ticket_id = ?`,
      [ticket.id]
    );
    return res.status(200).json({ ticket, selecciones });
  } catch (err) {
    console.error('[ticket.controller] buscarTicketPorSerie:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/tickets/:id ─────────────────────────────────────────────────────

async function obtenerTicket(req, res) {
  const { id }             = req.params;
  const { rol, bodega_id } = req.usuario;

  try {
    const rows = await query(
      `SELECT t.*, b.nombre AS bodega_nombre, u.nombre_usuario
          FROM tickets t
          JOIN bodegas b ON b.id = t.bodega_id
          JOIN usuarios u ON u.id = t.usuario_id
        WHERE t.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

    const ticket = rows[0];
    if (rol === 'bodeguero' && ticket.bodega_id !== bodega_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const selecciones = await query(
      `SELECT st.*, e.equipo_local, e.equipo_visitante, e.liga, e.deporte,
              e.fecha_inicio, e.estado AS evento_estado, e.resultado_final,
              m.nombre AS modalidad_nombre, m.descripcion AS modalidad_descripcion
          FROM selecciones_ticket st
          JOIN eventos e ON e.id = st.evento_id
          JOIN modalidades m ON m.id = st.modalidad_id
        WHERE st.ticket_id = ?`,
      [ticket.id]
    );
    const [pago] = await query(
      `SELECT p.tipo, p.monto_pagado_usd, p.monto_pagado_bs, p.moneda, p.tasa_bcv_pago, p.fecha_pago,
              u.nombre_usuario AS pagado_por
         FROM pagos p JOIN usuarios u ON u.id = p.usuario_quien_pago
        WHERE p.ticket_id = ? LIMIT 1`,
      [ticket.id]
    );
    return res.status(200).json({ ticket, selecciones, pago: pago ?? null });
  } catch (err) {
    console.error('[ticket.controller] obtenerTicket:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/tickets/qr/:serie ───────────────────────────────────────────────

async function consultarQR(req, res) {
  const { serie }                         = req.params;
  const { rol, bodega_id: bodegaUsuario } = req.usuario;
  if (!serie) return res.status(400).json({ error: 'Número de serie requerido' });

  try {
    const rows = await query(
      `SELECT t.id, t.numero_serie, t.estado, t.modo_impresion,
              t.monto_apostado_usd, t.monto_apostado_bs,
              t.ganancia_potencial_usd, t.ganancia_potencial_bs,
              t.tasa_bcv_dia, t.cuota_combinada, t.moneda_pago,
              t.fecha_creacion, t.fecha_vencimiento_cobro,
              t.hash_sha256, t.bodega_id,
              b.nombre AS bodega_nombre
         FROM tickets t
         JOIN bodegas b ON b.id = t.bodega_id
        WHERE t.numero_serie = ? LIMIT 1`,
      [serie]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

    const ticket = rows[0];
    if (rol === 'bodeguero' && Number(ticket.bodega_id) !== Number(bodegaUsuario)) {
      return res.status(403).json({ error: 'Este ticket no pertenece a tu bodega' });
    }

    const selecciones = await query(
      `SELECT e.equipo_local, e.equipo_visitante, e.liga, e.deporte,
              e.fecha_inicio, e.resultado_final,
              st.seleccion, st.cuota_aplicada, st.cuota_total, st.resultado,
              st.marcador_local, st.marcador_visitante, st.detalle_fin,
              m.nombre AS modalidad_nombre
         FROM selecciones_ticket st
         JOIN eventos     e ON e.id = st.evento_id
         JOIN modalidades m ON m.id = st.modalidad_id
        WHERE st.ticket_id = ? ORDER BY st.id ASC`,
      [ticket.id]
    );

    const hash_valido = typeof ticket.hash_sha256 === 'string' && ticket.hash_sha256.length === 64;

    return res.status(200).json({
      serie:                   ticket.numero_serie,
      estado:                  ticket.estado,
      modo_impresion:          ticket.modo_impresion,
      moneda_pago:             ticket.moneda_pago,
      monto_apostado_usd:      Number(ticket.monto_apostado_usd),
      monto_apostado_bs:       Number(ticket.monto_apostado_bs),
      ganancia_potencial_usd:  Number(ticket.ganancia_potencial_usd),
      ganancia_potencial_bs:   Number(ticket.ganancia_potencial_bs),
      tasa_bcv_dia:            Number(ticket.tasa_bcv_dia),
      cuota_combinada:         Number(ticket.cuota_combinada),
      fecha_creacion:          ticket.fecha_creacion,
      fecha_vencimiento_cobro: ticket.fecha_vencimiento_cobro,
      bodega_nombre:           ticket.bodega_nombre,
      hash_valido,
      selecciones: selecciones.map((s) => ({
        equipos:         `${s.equipo_local} vs ${s.equipo_visitante}`,
        deporte:         s.deporte,
        liga:            s.liga,
        modalidad:       s.modalidad_nombre,
        seleccion:       s.seleccion,
        cuota:           Number(s.cuota_total ?? s.cuota_aplicada),
        marcador:        s.marcador_local !== null ? `${s.marcador_local}-${s.marcador_visitante}` : null,
        detalle_fin:     s.detalle_fin ?? null,
        resultado:       s.resultado,
        resultado_final: s.resultado_final ?? null,
      })),
    });
  } catch (err) {
    console.error('[ticket.controller] consultarQR:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/tickets/:id/modo-impresion ────────────────────────────────────

async function actualizarModoImpresion(req, res) {
  const { id }             = req.params;
  const { modo_impresion } = req.body;
  const { rol, bodega_id } = req.usuario;

  if (!['fisica', 'digital'].includes(modo_impresion)) {
    return res.status(400).json({ error: "modo_impresion debe ser 'fisica' o 'digital'" });
  }

  try {
    const rows = await query(
      `SELECT id, bodega_id FROM tickets WHERE id = ? LIMIT 1`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

    if (rol === 'bodeguero' && rows[0].bodega_id !== bodega_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    await query(
      `UPDATE tickets SET modo_impresion = ?, updated_at = NOW() WHERE id = ?`,
      [modo_impresion, id]
    );

    return res.status(200).json({ mensaje: 'Modo de impresión registrado' });
  } catch (err) {
    console.error('[ticket.controller] actualizarModoImpresion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/tickets/:id/solicitar-anulacion ────────────────────────────────

async function solicitarAnulacion(req, res) {
  const { id }                          = req.params;
  const { motivo }                      = req.body;
  const { id: usuarioId, bodega_id, rol } = req.usuario;
  const ip = _ip(req);

  if (!motivo) return res.status(400).json({ error: 'motivo es requerido' });

  try {
    const rows = await query(
      `SELECT id, bodega_id, estado, numero_serie FROM tickets WHERE id = ? LIMIT 1`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

    const ticket = rows[0];
    if (rol === 'bodeguero' && ticket.bodega_id !== bodega_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (!['PENDIENTE', 'GANADO'].includes(ticket.estado)) {
      return res.status(409).json({ error: `No se puede anular un ticket en estado ${ticket.estado}` });
    }

    const solExist = await query(
      `SELECT id FROM solicitudes_anulacion WHERE ticket_id = ? AND estado = 'pendiente' LIMIT 1`, [id]
    );
    if (solExist.length > 0) {
      return res.status(409).json({ error: 'Ya existe una solicitud de anulación pendiente' });
    }

    const result = await query(
      `INSERT INTO solicitudes_anulacion (ticket_id, solicitado_por, motivo, estado) VALUES (?,?,?,'pendiente')`,
      [id, usuarioId, motivo]
    );

    await _notificar('solicitud_anulacion',
      `Solicitud de anulación del ticket ${ticket.numero_serie}. ¿Aprobar?`,
      'ambos', result.insertId, 'solicitudes_anulacion');
    await _log(usuarioId, 'solicitar_anulacion', 'tickets', Number(id),
      { numero_serie: ticket.numero_serie, motivo }, ip);

    return res.status(201).json({ mensaje: 'Solicitud enviada al administrador', solicitud_id: result.insertId });
  } catch (err) {
    console.error('[ticket.controller] solicitarAnulacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/tickets/anulaciones ────────────────────────────────────────────

async function listarSolicitudesAnulacion(req, res) {
  const { estado = 'pendiente' } = req.query;
  try {
    const rows = await query(
      `SELECT sa.*, t.numero_serie, t.monto_apostado_usd, t.bodega_id,
              u.nombre_usuario AS solicitado_por_nombre,
              b.nombre AS bodega_nombre
          FROM solicitudes_anulacion sa
          JOIN tickets t ON t.id = sa.ticket_id
          JOIN usuarios u ON u.id = sa.solicitado_por
          JOIN bodegas b ON b.id = t.bodega_id
        WHERE sa.estado = ?
        ORDER BY sa.created_at DESC`,
      [estado]
    );
    return res.status(200).json({ solicitudes: rows });
  } catch (err) {
    console.error('[ticket.controller] listarSolicitudesAnulacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/tickets/anulaciones/:solicitudId ──────────────────────────────

async function responderAnulacion(req, res) {
  const { solicitudId }    = req.params;
  const decision           = req.body?.decision ?? req.body?.estado;
  const { id: usuarioId }  = req.usuario;
  const ip = _ip(req);

  if (!['aprobada', 'rechazada'].includes(decision)) {
    return res.status(400).json({ error: "decision debe ser 'aprobada' o 'rechazada'" });
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [[sol]] = await conn.query(
      `SELECT * FROM solicitudes_anulacion WHERE id = ? FOR UPDATE`, [solicitudId]
    );
    if (!sol) throw new ErrorApuesta(404, 'Solicitud no encontrada');
    if (sol.estado !== 'pendiente') throw new ErrorApuesta(409, 'Solicitud ya procesada');

    // Bloquea el ticket: entre la solicitud y la respuesta pudo haberse pagado o resuelto
    const [[ticket]] = await conn.query(
      `SELECT id, numero_serie, estado FROM tickets WHERE id = ? FOR UPDATE`, [sol.ticket_id]
    );
    if (decision === 'aprobada' && !['PENDIENTE', 'GANADO'].includes(ticket.estado)) {
      throw new ErrorApuesta(409, `No se puede anular: el ticket ahora está ${ticket.estado}`);
    }

    await conn.query(
      `UPDATE solicitudes_anulacion SET estado = ?, revisado_por = ?, fecha_revision = NOW(), updated_at = NOW() WHERE id = ?`,
      [decision, usuarioId, solicitudId]
    );
    if (decision === 'aprobada') {
      await conn.query(`UPDATE tickets SET estado = 'ANULADO', updated_at = NOW() WHERE id = ?`, [ticket.id]);
    }

    await conn.commit();

    await _log(usuarioId, `anulacion_${decision}`, 'tickets', ticket.id,
      { numero_serie: ticket.numero_serie, solicitud_id: solicitudId }, ip);

    return res.status(200).json({ mensaje: `Solicitud ${decision}` });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return _responderError(res, err, 'responderAnulacion');
  } finally {
    conn.release();
  }
}

// Bloquea el ticket y verifica bodega/estado para pagos y devoluciones
async function _bloquearTicket(conn, id, usuario, estadoRequerido) {
  const [[ticket]] = await conn.query(
    `SELECT t.*, t.fecha_vencimiento_cobro > NOW() AS cobro_vigente
       FROM tickets t WHERE t.id = ? FOR UPDATE`,
    [id]
  );
  if (!ticket) throw new ErrorApuesta(404, 'Ticket no encontrado');
  if (usuario.rol === 'bodeguero' && Number(ticket.bodega_id) !== Number(usuario.bodega_id))
    throw new ErrorApuesta(403, 'Acceso denegado');
  if (ticket.estado !== estadoRequerido)
    throw new ErrorApuesta(409, `Solo tickets ${estadoRequerido}. Estado actual: ${ticket.estado}`);
  return ticket;
}

// ─── POST /api/tickets/:id/pagar ──────────────────────────────────────────────

async function procesarPago(req, res) {
  const { id }  = req.params;
  const moneda  = ['USD', 'BS'].includes(req.body?.moneda) ? req.body.moneda : null;
  const { id: usuarioId } = req.usuario;
  const ip = _ip(req);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const ticket = await _bloquearTicket(conn, id, req.usuario, 'GANADO');
    if (ticket.fecha_vencimiento_cobro && !ticket.cobro_vigente)
      throw new ErrorApuesta(409, 'El plazo de cobro de este premio venció');

    const tasa     = await _obtenerTasaBcv();
    const montoUsd = parseFloat(ticket.ganancia_potencial_usd);
    const montoBs  = Math.round(montoUsd * tasa * 100) / 100;
    const ahora    = new Date();

    await conn.query(
      `INSERT INTO pagos (ticket_id, tipo, monto_pagado_usd, monto_pagado_bs, moneda, tasa_bcv_pago,
          usuario_quien_pago, fecha_pago) VALUES (?,'premio',?,?,?,?,?,?)`,
      [ticket.id, montoUsd, montoBs, moneda ?? ticket.moneda_pago, tasa, usuarioId, ahora]
    );
    await conn.query(
      `UPDATE tickets SET estado = 'PAGADO', fecha_cobro = ?, updated_at = NOW() WHERE id = ?`,
      [ahora, ticket.id]
    );

    await conn.commit();

    await _notificar('premio_alto_pagado',
      `Ticket ${ticket.numero_serie} pagó $${montoUsd} en bodega ${ticket.bodega_id}`,
      'ambos', ticket.id, 'tickets');
    await _log(usuarioId, 'pagar_premio', 'tickets', ticket.id,
      { numero_serie: ticket.numero_serie, monto_usd: montoUsd, moneda: moneda ?? ticket.moneda_pago }, ip);

    return res.status(200).json({
      mensaje: 'Premio pagado correctamente',
      pago: { ticket_id: ticket.id, numero_serie: ticket.numero_serie, monto_pagado_usd: montoUsd, monto_pagado_bs: montoBs },
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return _responderError(res, err, 'procesarPago');
  } finally {
    conn.release();
  }
}

// ─── POST /api/tickets/:id/reembolsar ─────────────────────────────────────────
// Ticket SUSPENDIDO (evento suspendido/cancelado): se devuelve lo apostado,
// en la misma moneda y monto con que se pagó (tasa del día de la apuesta).

async function reembolsarTicket(req, res) {
  const { id } = req.params;
  const { id: usuarioId } = req.usuario;
  const ip = _ip(req);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const ticket = await _bloquearTicket(conn, id, req.usuario, 'SUSPENDIDO');
    const ahora  = new Date();

    await conn.query(
      `INSERT INTO pagos (ticket_id, tipo, monto_pagado_usd, monto_pagado_bs, moneda, tasa_bcv_pago,
          usuario_quien_pago, fecha_pago) VALUES (?,'reembolso',?,?,?,?,?,?)`,
      [ticket.id, ticket.monto_apostado_usd, ticket.monto_apostado_bs, ticket.moneda_pago,
        ticket.tasa_bcv_dia, usuarioId, ahora]
    );
    await conn.query(
      `UPDATE tickets SET estado = 'REEMBOLSADO', fecha_cobro = ?, updated_at = NOW() WHERE id = ?`,
      [ahora, ticket.id]
    );
    await conn.commit();

    await _notificar('ticket_reembolsado',
      `Ticket ${ticket.numero_serie} reembolsado: $${ticket.monto_apostado_usd} (${ticket.moneda_pago}) en bodega ${ticket.bodega_id}`,
      'ambos', ticket.id, 'tickets');
    await _log(usuarioId, 'reembolsar_ticket', 'tickets', ticket.id,
      { numero_serie: ticket.numero_serie, monto_usd: ticket.monto_apostado_usd }, ip);

    return res.status(200).json({
      mensaje: 'Dinero devuelto al cliente',
      reembolso: {
        ticket_id: ticket.id, numero_serie: ticket.numero_serie, moneda: ticket.moneda_pago,
        monto_usd: Number(ticket.monto_apostado_usd), monto_bs: Number(ticket.monto_apostado_bs),
      },
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return _responderError(res, err, 'reembolsarTicket');
  } finally {
    conn.release();
  }
}

module.exports = {
  crearTicket,
  sincronizarOffline,
  listarTickets,
  buscarTicketPorSerie,
  obtenerTicket,
  consultarQR,
  actualizarModoImpresion,
  solicitarAnulacion,
  listarSolicitudesAnulacion,
  responderAnulacion,
  procesarPago,
  reembolsarTicket,
};
