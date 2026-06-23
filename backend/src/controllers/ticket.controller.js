'use strict';

const crypto  = require('crypto');
const { query, getConnection }    = require('../config/db');
const { getCache, KEYS }          = require('../config/redis');

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function _ip(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
}

async function _obtenerTasaBcv() {
  const cached = await getCache(KEYS.BCV_TASA_ACTUAL, true);
  if (cached && cached.valor) return parseFloat(cached.valor);
  const rows = await query(
    `SELECT valor FROM tasa_bcv WHERE validada = 1 ORDER BY fecha DESC, id DESC LIMIT 1`
  );
  if (rows.length === 0) throw new Error('Tasa BCV no disponible');
  return parseFloat(rows[0].valor);
}

function _generarNumeroSerie(bodegaPrefijo) {
  const r4 = () => String(Math.floor(1000 + Math.random() * 9000));
  return `${bodegaPrefijo}-${r4()}-${r4()}`;
}

function _generarHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function _calcularGanancia(montoUsd, cuotaCombinada) {
  return Math.round(montoUsd * cuotaCombinada * 100) / 100;
}

const MAX_GANANCIA_USD = 300;
const APUESTA_MINIMA   = 1;

// ─── POST /api/tickets ────────────────────────────────────────────────────────

async function crearTicket(req, res) {
  const { id: usuarioId, bodega_id, bodega_prefijo } = req.usuario;
  const ip = _ip(req);

  const { selecciones, monto_apostado_usd, moneda_pago, origen = 'online', hash_cliente } = req.body;

  // --- validaciones básicas ---
  if (!selecciones || !Array.isArray(selecciones) || selecciones.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una selección' });
  }
  if (!monto_apostado_usd || parseFloat(monto_apostado_usd) < APUESTA_MINIMA) {
    return res.status(400).json({ error: `Apuesta mínima es $${APUESTA_MINIMA}` });
  }
  if (!['USD', 'BS'].includes(moneda_pago)) {
    return res.status(400).json({ error: "moneda_pago debe ser 'USD' o 'BS'" });
  }
  if (!bodega_id || !bodega_prefijo) {
    return res.status(403).json({ error: 'El bodeguero no tiene bodega asignada' });
  }

  // Evento único por ticket
  const eventosIds = selecciones.map(s => s.evento_id);
  if (new Set(eventosIds).size !== eventosIds.length) {
    return res.status(400).json({ error: 'No puedes incluir el mismo evento dos veces en un ticket' });
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const montoUsd = parseFloat(monto_apostado_usd);
    const tasa     = await _obtenerTasaBcv();

    // --- validar cada selección ---
    let cuotaCombinada = 1;
    const seleccionesValidas = [];

    for (const sel of selecciones) {
      const { evento_id, modalidad_id, seleccion } = sel;
      if (!evento_id || !modalidad_id || !seleccion) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ error: 'Cada selección necesita evento_id, modalidad_id y seleccion' });
      }

      // evento activo y programado
      const [evento] = (await conn.query(
        `SELECT id, deporte, estado, activo, liga, equipo_local, equipo_visitante
            FROM eventos WHERE id = ? LIMIT 1`, [evento_id]
      ))[0];

      if (!evento) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ error: `Evento ${evento_id} no encontrado` });
      }
      if (evento.estado !== 'programado' || !evento.activo) {
        await conn.rollback(); conn.release();
        return res.status(409).json({ error: `Evento ${evento_id} no está disponible para apuestas` });
      }

      // categoría activa
      const [catConfig] = (await conn.query(
        `SELECT activa FROM categorias_config WHERE deporte = ? LIMIT 1`, [evento.deporte]
      ))[0];
      if (!catConfig || !catConfig.activa) {
        await conn.rollback(); conn.release();
        return res.status(409).json({ error: `Categoría ${evento.deporte} está desactivada` });
      }

      // modalidad activa y del mismo deporte
      const [modalidad] = (await conn.query(
        `SELECT id, cuota_base, nombre, activa, deporte
            FROM modalidades WHERE id = ? LIMIT 1`, [modalidad_id]
      ))[0];
      if (!modalidad || !modalidad.activa) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ error: `Modalidad ${modalidad_id} no encontrada o desactivada` });
      }
      if (modalidad.deporte !== evento.deporte) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ error: `Modalidad ${modalidad_id} no corresponde al deporte del evento` });
      }

      cuotaCombinada = Math.round(cuotaCombinada * parseFloat(modalidad.cuota_base) * 10000) / 10000;
      seleccionesValidas.push({ evento_id, modalidad_id, seleccion, cuota_aplicada: parseFloat(modalidad.cuota_base) });
    }

    // --- calcular ganancia potencial ---
    let gananciaPotencialUsd = _calcularGanancia(montoUsd, cuotaCombinada);

    // Ajustar monto si supera $300
    if (gananciaPotencialUsd > MAX_GANANCIA_USD) {
      const montoAjustado = Math.floor((MAX_GANANCIA_USD / cuotaCombinada) * 100) / 100;
      await conn.rollback(); conn.release();
      return res.status(400).json({
        error: `La ganancia potencial excede $${MAX_GANANCIA_USD}. Monto máximo permitido: $${montoAjustado}`,
        monto_maximo: montoAjustado,
        cuota_combinada: cuotaCombinada,
      });
    }

    const gananciaPotencialBs = Math.round(gananciaPotencialUsd * tasa * 100) / 100;
    const montoApostadoBs     = Math.round(montoUsd * tasa * 100) / 100;

    // --- generar numero_serie único ---
    let numeroSerie;
    let serieUnica = false;
    let intentos = 0;
    while (!serieUnica && intentos < 10) {
      numeroSerie = _generarNumeroSerie(bodega_prefijo);
      const [exist] = (await conn.query(
        `SELECT id FROM tickets WHERE numero_serie = ? LIMIT 1`, [numeroSerie]
      ))[0];
      if (!exist) serieUnica = true;
      intentos++;
    }
    if (!serieUnica) {
      await conn.rollback(); conn.release();
      return res.status(500).json({ error: 'Error generando número de serie, reintenta' });
    }

    // --- hash SHA-256 ---
    const ahora      = new Date();
    const hashInput  = { numeroSerie, bodega_id, usuarioId, montoUsd, cuotaCombinada, seleccionesValidas, ts: ahora.toISOString() };
    const hashSha256 = _generarHash(hashInput);

    // --- insertar ticket ---
    const [ticketResult] = await conn.query(
      `INSERT INTO tickets
          (numero_serie, bodega_id, usuario_id, monto_apostado_usd, monto_apostado_bs,
          tasa_bcv_dia, cuota_combinada, ganancia_potencial_usd, ganancia_potencial_bs,
          estado, moneda_pago, origen, sincronizado, hash_sha256, fecha_creacion)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        numeroSerie, bodega_id, usuarioId,
        montoUsd, montoApostadoBs, tasa,
        cuotaCombinada, gananciaPotencialUsd, gananciaPotencialBs,
        'PENDIENTE', moneda_pago, origen,
        origen === 'online' ? 1 : 0,
        hashSha256, ahora,
      ]
    );
    const ticketId = ticketResult.insertId;

    // --- insertar selecciones ---
    for (const sel of seleccionesValidas) {
      await conn.query(
        `INSERT INTO selecciones_ticket (ticket_id, evento_id, modalidad_id, cuota_aplicada, seleccion, resultado)
          VALUES (?,?,?,?,?,?)`,
        [ticketId, sel.evento_id, sel.modalidad_id, sel.cuota_aplicada, sel.seleccion, 'pendiente']
      );
    }

    await conn.commit();
    conn.release();

    // --- notificar si ganancia alta ---
    if (gananciaPotencialUsd >= 200) {
      await _notificar(
        'ticket_ganador',
        `Ticket ${numeroSerie} con ganancia potencial $${gananciaPotencialUsd} creado en bodega ${bodega_id}`,
        'ambos', ticketId, 'tickets'
      );
    }

    await _log(usuarioId, 'crear_ticket', 'tickets', ticketId,
      { numeroSerie, montoUsd, cuotaCombinada, gananciaPotencialUsd, origen }, ip);

    return res.status(201).json({
      ticket: {
        id:                    ticketId,
        numero_serie:          numeroSerie,
        monto_apostado_usd:    montoUsd,
        monto_apostado_bs:     montoApostadoBs,
        tasa_bcv_dia:          tasa,
        cuota_combinada:       cuotaCombinada,
        ganancia_potencial_usd: gananciaPotencialUsd,
        ganancia_potencial_bs:  gananciaPotencialBs,
        estado:                'PENDIENTE',
        moneda_pago,
        origen,
        hash_sha256:           hashSha256,
        fecha_creacion:        ahora,
        selecciones:           seleccionesValidas,
      }
    });

  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch {}
    console.error('[ticket.controller] crearTicket:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/tickets/sync-offline ──────────────────────────────────────────

async function sincronizarOffline(req, res) {
  const { cola } = req.body; // array de tickets offline con sus hashes
  if (!Array.isArray(cola) || cola.length === 0) {
    return res.status(400).json({ error: 'cola debe ser un arreglo no vacío' });
  }

  const resultados = [];
  for (const ticketOffline of cola) {
    const { hash_sha256, numero_serie, bodega_id, usuario_id, monto_apostado_usd,
            cuota_combinada, selecciones, ts, moneda_pago } = ticketOffline;

    // Verificar hash
    const hashEsperado = _generarHash({
      numeroSerie: numero_serie, bodega_id, usuarioId: usuario_id,
      montoUsd: monto_apostado_usd, cuotaCombinada: cuota_combinada,
      seleccionesValidas: selecciones, ts,
    });

    if (hashEsperado !== hash_sha256) {
      resultados.push({ numero_serie, estado: 'rechazado', motivo: 'Hash inválido — ticket modificado' });
      await _log(req.usuario.id, 'sync_offline_rechazado', 'tickets', null,
        { numero_serie, motivo: 'hash_invalido' }, _ip(req));
      continue;
    }

    // Verificar si ya existe
    const existe = await query(`SELECT id FROM tickets WHERE numero_serie = ? LIMIT 1`, [numero_serie]);
    if (existe.length > 0) {
      resultados.push({ numero_serie, estado: 'ya_existe' });
      continue;
    }

    // Crear ticket igual que online pero con origen='offline', sincronizado=1
    const fakReq = {
      body: { selecciones, monto_apostado_usd, moneda_pago, origen: 'offline' },
      usuario: req.usuario,
      ip: _ip(req),
      headers: req.headers,
    };
    // Inserción directa para respetar el numero_serie y hash originales del offline
    try {
      const tasa = await _obtenerTasaBcv();
      const montoUsd = parseFloat(monto_apostado_usd);
      const gananciaPotencialUsd = _calcularGanancia(montoUsd, parseFloat(cuota_combinada));
      const montoApostadoBs      = Math.round(montoUsd * tasa * 100) / 100;
      const gananciaPotencialBs  = Math.round(gananciaPotencialUsd * tasa * 100) / 100;

      const result = await query(
        `INSERT INTO tickets
            (numero_serie, bodega_id, usuario_id, monto_apostado_usd, monto_apostado_bs,
            tasa_bcv_dia, cuota_combinada, ganancia_potencial_usd, ganancia_potencial_bs,
            estado, moneda_pago, origen, sincronizado, hash_sha256, fecha_creacion)
          VALUES (?,?,?,?,?,?,?,?,?,'PENDIENTE',?,?,1,?,?)`,
        [numero_serie, bodega_id, usuario_id,
          montoUsd, montoApostadoBs, tasa,
          cuota_combinada, gananciaPotencialUsd, gananciaPotencialBs,
          moneda_pago, 'offline', hash_sha256, new Date(ts)]
      );
      const ticketId = result.insertId;

      for (const sel of selecciones) {
        await query(
          `INSERT INTO selecciones_ticket (ticket_id, evento_id, modalidad_id, cuota_aplicada, seleccion, resultado)
            VALUES (?,?,?,?,?,'pendiente')`,
          [ticketId, sel.evento_id, sel.modalidad_id, sel.cuota_aplicada, sel.seleccion]
        );
      }

      resultados.push({ numero_serie, estado: 'sincronizado', ticket_id: ticketId });
      await _log(req.usuario.id, 'sync_offline_ok', 'tickets', ticketId, { numero_serie }, _ip(req));
    } catch (e) {
      resultados.push({ numero_serie, estado: 'error', motivo: e.message });
    }
  }

  return res.status(200).json({ resultados });
}

// ─── GET /api/tickets ─────────────────────────────────────────────────────────

async function listarTickets(req, res) {
  const { rol, bodega_id } = req.usuario;
  const { estado, fecha_desde, fecha_hasta, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let sql = `SELECT t.id, t.numero_serie, t.bodega_id, t.usuario_id,
                      t.monto_apostado_usd, t.monto_apostado_bs, t.tasa_bcv_dia,
                      t.cuota_combinada, t.ganancia_potencial_usd, t.ganancia_potencial_bs,
                      t.estado, t.moneda_pago, t.origen, t.fecha_creacion,
                      t.fecha_estado_ganado, t.fecha_vencimiento_cobro,
                      b.nombre AS bodega_nombre, u.nombre_usuario
                  FROM tickets t
                  JOIN bodegas b ON b.id = t.bodega_id
                  JOIN usuarios u ON u.id = t.usuario_id
                WHERE 1=1`;
    const params = [];

    // Bodeguero solo ve su bodega
    if (rol === 'bodeguero') { sql += ' AND t.bodega_id = ?'; params.push(bodega_id); }

    if (estado)       { sql += ' AND t.estado = ?';                    params.push(estado); }
    if (fecha_desde)  { sql += ' AND DATE(t.fecha_creacion) >= ?';     params.push(fecha_desde); }
    if (fecha_hasta)  { sql += ' AND DATE(t.fecha_creacion) <= ?';     params.push(fecha_hasta); }

    sql += ' ORDER BY t.fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const tickets = await query(sql, params);
    return res.status(200).json({ tickets, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[ticket.controller] listarTickets:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/tickets/buscar?serie= ──────────────────────────────────────────

async function buscarTicketPorSerie(req, res) {
  const { serie } = req.query;
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
  const { id } = req.params;
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

    return res.status(200).json({ ticket, selecciones });
  } catch (err) {
    console.error('[ticket.controller] obtenerTicket:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/tickets/:id/solicitar-anulacion ────────────────────────────────

async function solicitarAnulacion(req, res) {
  const { id } = req.params;
  const { motivo } = req.body;
  const { id: usuarioId, bodega_id, rol } = req.usuario;
  const ip = _ip(req);

  if (!motivo) return res.status(400).json({ error: 'motivo es requerido' });

  try {
    const rows = await query(`SELECT id, bodega_id, estado, numero_serie FROM tickets WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

    const ticket = rows[0];
    if (rol === 'bodeguero' && ticket.bodega_id !== bodega_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (!['PENDIENTE', 'GANADO'].includes(ticket.estado)) {
      return res.status(409).json({ error: `No se puede anular un ticket en estado ${ticket.estado}` });
    }

    // Verificar que no haya solicitud pendiente activa
    const solExist = await query(
      `SELECT id FROM solicitudes_anulacion WHERE ticket_id = ? AND estado = 'pendiente' LIMIT 1`, [id]
    );
    if (solExist.length > 0) {
      return res.status(409).json({ error: 'Ya existe una solicitud de anulación pendiente para este ticket' });
    }

    const result = await query(
      `INSERT INTO solicitudes_anulacion (ticket_id, solicitado_por, motivo, estado) VALUES (?,?,?,?)`,
      [id, usuarioId, motivo, 'pendiente']
    );

    await _notificar(
      'solicitud_anulacion',
      `Solicitud de anulación del ticket ${ticket.numero_serie}. ¿Aprobar?`,
      'ambos', result.insertId, 'solicitudes_anulacion'
    );
    await _log(usuarioId, 'solicitar_anulacion', 'tickets', Number(id),
      { numero_serie: ticket.numero_serie, motivo }, ip);

    return res.status(201).json({ mensaje: 'Solicitud de anulación enviada al administrador', solicitud_id: result.insertId });
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
  const { solicitudId } = req.params;
  const { decision } = req.body; // 'aprobada' | 'rechazada'
  const { id: usuarioId } = req.usuario;
  const ip = _ip(req);

  if (!['aprobada', 'rechazada'].includes(decision)) {
    return res.status(400).json({ error: "decision debe ser 'aprobada' o 'rechazada'" });
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [sol] = (await conn.query(
      `SELECT sa.*, t.numero_serie, t.estado AS ticket_estado
          FROM solicitudes_anulacion sa
          JOIN tickets t ON t.id = sa.ticket_id
        WHERE sa.id = ? LIMIT 1`,
      [solicitudId]
    ))[0];

    if (!sol) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Solicitud no encontrada' }); }
    if (sol.estado !== 'pendiente') { await conn.rollback(); conn.release(); return res.status(409).json({ error: 'Solicitud ya procesada' }); }

    await conn.query(
      `UPDATE solicitudes_anulacion SET estado = ?, revisado_por = ?, fecha_revision = NOW(), updated_at = NOW() WHERE id = ?`,
      [decision, usuarioId, solicitudId]
    );

    if (decision === 'aprobada') {
      await conn.query(
        `UPDATE tickets SET estado = 'ANULADO', updated_at = NOW() WHERE id = ?`,
        [sol.ticket_id]
      );
    }

    await conn.commit();
    conn.release();

    await _log(usuarioId, `anulacion_${decision}`, 'tickets', sol.ticket_id,
      { numero_serie: sol.numero_serie, solicitud_id: solicitudId }, ip);

    return res.status(200).json({ mensaje: `Solicitud ${decision}` });
  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch {}
    console.error('[ticket.controller] responderAnulacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/tickets/:id/pagar ─────────────────────────────────────────────

async function procesarPago(req, res) {
  const { id } = req.params;
  const { cedula_foto_url } = req.body; // requerida si ganancia = $300
  const { id: usuarioId, bodega_id, rol } = req.usuario;
  const ip = _ip(req);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [ticket] = (await conn.query(
      `SELECT t.*, b.prefijo AS bodega_prefijo
          FROM tickets t
          JOIN bodegas b ON b.id = t.bodega_id
        WHERE t.id = ? LIMIT 1`,
      [id]
    ))[0];

    if (!ticket) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Ticket no encontrado' }); }
    if (rol === 'bodeguero' && ticket.bodega_id !== bodega_id) {
      await conn.rollback(); conn.release(); return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (ticket.estado !== 'GANADO') {
      await conn.rollback(); conn.release();
      return res.status(409).json({ error: `Solo se pueden pagar tickets en estado GANADO. Estado actual: ${ticket.estado}` });
    }

    // Cédula obligatoria si ganancia = MAX
    if (parseFloat(ticket.ganancia_potencial_usd) >= MAX_GANANCIA_USD && !cedula_foto_url) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: `Ganancia de $${MAX_GANANCIA_USD}: se requiere foto de cédula (cedula_foto_url)` });
    }

    const tasa        = await _obtenerTasaBcv();
    const montoUsd    = parseFloat(ticket.ganancia_potencial_usd);
    const montoBs     = Math.round(montoUsd * tasa * 100) / 100;
    const ahora       = new Date();

    await conn.query(
      `INSERT INTO pagos
          (ticket_id, monto_pagado_usd, monto_pagado_bs, moneda, tasa_bcv_pago,
          usuario_quien_pago, fecha_pago, cedula_foto_url)
        VALUES (?,?,?,?,?,?,?,?)`,
      [ticket.id, montoUsd, montoBs, ticket.moneda_pago, tasa, usuarioId, ahora, cedula_foto_url ?? null]
    );

    await conn.query(
      `UPDATE tickets SET estado = 'PAGADO', fecha_cobro = ?, updated_at = NOW() WHERE id = ?`,
      [ahora, ticket.id]
    );

    await conn.commit();
    conn.release();

    await _notificar(
      'premio_alto_pagado',
      `Ticket ${ticket.numero_serie} pagó $${montoUsd} en bodega ${ticket.bodega_id}`,
      'ambos', ticket.id, 'tickets'
    );
    await _log(usuarioId, 'pagar_premio', 'tickets', ticket.id,
      { numero_serie: ticket.numero_serie, monto_usd: montoUsd, moneda: ticket.moneda_pago }, ip);

    return res.status(200).json({
      mensaje: 'Premio pagado correctamente',
      pago: { ticket_id: ticket.id, numero_serie: ticket.numero_serie, monto_pagado_usd: montoUsd, monto_pagado_bs: montoBs, moneda: ticket.moneda_pago }
    });
  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch {}
    console.error('[ticket.controller] procesarPago:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  crearTicket,
  sincronizarOffline,
  listarTickets,
  buscarTicketPorSerie,
  obtenerTicket,
  solicitarAnulacion,
  listarSolicitudesAnulacion,
  responderAnulacion,
  procesarPago,
};