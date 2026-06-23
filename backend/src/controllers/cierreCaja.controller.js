'use strict';

const bcrypt = require('bcrypt');
const { query }          = require('../config/db');
const { delCache, KEYS } = require('../config/redis');

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

// ─── GET /api/cierre-caja/resumen ─────────────────────────────────────────────
// Calcula automáticamente los totales del día para el bodeguero activo

async function obtenerResumenCaja(req, res) {
  const { id: usuarioId, bodega_id, hora_apertura_sesion } = req.usuario;

  try {
    const hoy = new Date().toISOString().split('T')[0];

    // Total tickets vendidos (no ANULADO)
    const [totalesTickets] = await query(
      `SELECT
          COUNT(*)                                          AS tickets_vendidos,
          COUNT(CASE WHEN estado = 'ANULADO' THEN 1 END)   AS tickets_anulados,
          COALESCE(SUM(CASE WHEN estado != 'ANULADO' THEN monto_apostado_usd ELSE 0 END), 0) AS total_recaudado_usd,
          COALESCE(SUM(CASE WHEN estado != 'ANULADO' THEN monto_apostado_bs  ELSE 0 END), 0) AS total_recaudado_bs
        FROM tickets
      WHERE usuario_id = ? AND DATE(fecha_creacion) = ?`,
      [usuarioId, hoy]
    );

    // Premios pagados hoy
    const [totalesPagos] = await query(
      `SELECT
         COALESCE(SUM(p.monto_pagado_usd), 0) AS premios_pagados_usd,
         COALESCE(SUM(p.monto_pagado_bs),  0) AS premios_pagados_bs
       FROM pagos p
       JOIN tickets t ON t.id = p.ticket_id
      WHERE t.usuario_id = ? AND DATE(p.fecha_pago) = ?`,
      [usuarioId, hoy]
    );

    const totalRecaudadoUsd = parseFloat(totalesTickets.total_recaudado_usd);
    const premiosPagadosUsd = parseFloat(totalesPagos.premios_pagados_usd);
    const gananciaBrutaUsd  = Math.round((totalRecaudadoUsd - premiosPagadosUsd) * 100) / 100;

    // Porcentajes desde configuracion_sistema
    const [cfgBodeguero] = await query(
      `SELECT valor FROM configuracion_sistema WHERE clave = 'porcentaje_bodeguero' LIMIT 1`
    );
    const [cfgOperador] = await query(
      `SELECT valor FROM configuracion_sistema WHERE clave = 'porcentaje_operador' LIMIT 1`
    );
    const pctBodeguero = parseFloat(cfgBodeguero?.valor ?? 20) / 100;
    const pctOperador  = parseFloat(cfgOperador?.valor ?? 80)  / 100;

    const gananciaBodegueroUsd = Math.round(gananciaBrutaUsd * pctBodeguero * 100) / 100;
    const gananciaOperadorUsd  = Math.round(gananciaBrutaUsd * pctOperador  * 100) / 100;

    return res.status(200).json({
      resumen: {
        fecha:                  hoy,
        hora_apertura_sesion:   hora_apertura_sesion ?? null,
        hora_actual:            new Date().toISOString(),
        tickets_vendidos:       totalesTickets.tickets_vendidos,
        tickets_anulados:       totalesTickets.tickets_anulados,
        total_calculado_usd:    totalRecaudadoUsd,
        total_calculado_bs:     parseFloat(totalesTickets.total_recaudado_bs),
        premios_pagados_usd:    premiosPagadosUsd,
        premios_pagados_bs:     parseFloat(totalesPagos.premios_pagados_bs),
        ganancia_bruta_usd:     gananciaBrutaUsd,
        ganancia_bodeguero_usd: gananciaBodegueroUsd,
        ganancia_operador_usd:  gananciaOperadorUsd,
        porcentaje_bodeguero:   pctBodeguero * 100,
        porcentaje_operador:    pctOperador  * 100,
      }
    });
  } catch (err) {
    console.error('[cierreCaja.controller] obtenerResumenCaja:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/cierre-caja ────────────────────────────────────────────────────
// Bodeguero declara montos y cierra sesión

async function cerrarCaja(req, res) {
  const { id: usuarioId, bodega_id, nombre_usuario, hora_apertura_sesion } = req.usuario;
  const { total_bs_declarado, total_usd_declarado, contrasena } = req.body;
  const ip = _ip(req);

  if (total_bs_declarado === undefined || total_usd_declarado === undefined || !contrasena) {
    return res.status(400).json({ error: 'total_bs_declarado, total_usd_declarado y contrasena son requeridos' });
  }
  if (!bodega_id) {
    return res.status(403).json({ error: 'Sin bodega asignada' });
  }

  try {
    // 1. Verificar contraseña
    const [usuarioDb] = await query(`SELECT contrasena_hash FROM usuarios WHERE id = ? LIMIT 1`, [usuarioId]);
    const passwordValida = await bcrypt.compare(contrasena, usuarioDb.contrasena_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const hoy = new Date().toISOString().split('T')[0];

    // 2. Verificar que no haya cierre previo hoy
    const cierreExistente = await query(
      `SELECT id FROM cierre_caja WHERE usuario_id = ? AND fecha = ? LIMIT 1`, [usuarioId, hoy]
    );
    if (cierreExistente.length > 0) {
      return res.status(409).json({ error: 'Ya realizaste el cierre de caja hoy' });
    }

    // 3. Calcular totales automáticos
    const [totalesTickets] = await query(
      `SELECT
          COUNT(*)                                         AS tickets_vendidos,
          COUNT(CASE WHEN estado = 'ANULADO' THEN 1 END)  AS tickets_anulados,
          COALESCE(SUM(CASE WHEN estado != 'ANULADO' THEN monto_apostado_usd ELSE 0 END), 0) AS total_calculado_usd,
          COALESCE(SUM(CASE WHEN estado != 'ANULADO' THEN monto_apostado_bs  ELSE 0 END), 0) AS total_calculado_bs
        FROM tickets
      WHERE usuario_id = ? AND DATE(fecha_creacion) = ?`,
      [usuarioId, hoy]
    );
    const [totalesPagos] = await query(
      `SELECT COALESCE(SUM(p.monto_pagado_usd), 0) AS premios_pagados_usd
          FROM pagos p
          JOIN tickets t ON t.id = p.ticket_id
        WHERE t.usuario_id = ? AND DATE(p.fecha_pago) = ?`,
      [usuarioId, hoy]
    );

    const totalCalculadoUsd = parseFloat(totalesTickets.total_calculado_usd);
    const totalCalculadoBs  = parseFloat(totalesTickets.total_calculado_bs);
    const totalDeclaradoUsd = parseFloat(total_usd_declarado);
    const totalDeclaradoBs  = parseFloat(total_bs_declarado);
    const discrepanciaUsd   = Math.round((totalDeclaradoUsd - totalCalculadoUsd) * 100) / 100;
    const discrepanciaBs    = Math.round((totalDeclaradoBs  - totalCalculadoBs)  * 100) / 100;
    const hayDiscrepancia   = Math.abs(discrepanciaUsd) > 0.01 || Math.abs(discrepanciaBs) > 0.01 ? 1 : 0;
    const horaCierre        = new Date();

    // 4. Registrar cierre de caja
    const result = await query(
      `INSERT INTO cierre_caja
          (usuario_id, bodega_id, fecha, tickets_vendidos, tickets_anulados,
          premios_pagados_usd, total_bs_declarado, total_usd_declarado,
          total_calculado_bs, total_calculado_usd,
          discrepancia_usd, discrepancia_bs, hay_discrepancia,
          hora_apertura, hora_cierre)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        usuarioId, bodega_id, hoy,
        totalesTickets.tickets_vendidos, totalesTickets.tickets_anulados,
        totalesPagos.premios_pagados_usd,
        totalDeclaradoBs, totalDeclaradoUsd,
        totalCalculadoBs, totalCalculadoUsd,
        discrepanciaUsd, discrepanciaBs, hayDiscrepancia,
        hora_apertura_sesion ?? horaCierre, horaCierre,
      ]
    );

    // 5. Cerrar sesión del usuario
    await query(
      `UPDATE usuarios SET sesion_activa = 0, hora_apertura_sesion = NULL, updated_at = NOW() WHERE id = ?`,
      [usuarioId]
    );
    await delCache(KEYS.sesion(usuarioId));

    // 6. Notificar discrepancia si existe
    if (hayDiscrepancia) {
      await _notificar(
        'discrepancia_caja',
        `"${nombre_usuario}" reportó $${totalDeclaradoUsd} USD pero el sistema calculó $${totalCalculadoUsd} USD (diff: $${discrepanciaUsd})`,
        'ambos', result.insertId, 'cierre_caja'
      );
    }

    await _log(usuarioId, 'cierre_caja', 'cierre_caja', result.insertId,
      { total_calculado_usd: totalCalculadoUsd, total_declarado_usd: totalDeclaradoUsd, hay_discrepancia: hayDiscrepancia }, ip);

    return res.status(201).json({
      mensaje: 'Cierre de caja registrado. Sesión cerrada hasta las 5:00 AM.',
      cierre: {
        id:                   result.insertId,
        fecha:                hoy,
        tickets_vendidos:     totalesTickets.tickets_vendidos,
        tickets_anulados:     totalesTickets.tickets_anulados,
        total_calculado_usd:  totalCalculadoUsd,
        total_declarado_usd:  totalDeclaradoUsd,
        discrepancia_usd:     discrepanciaUsd,
        hay_discrepancia:     hayDiscrepancia === 1,
        hora_apertura:        hora_apertura_sesion ?? null,
        hora_cierre:          horaCierre,
      }
    });
  } catch (err) {
    console.error('[cierreCaja.controller] cerrarCaja:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/cierre-caja ─────────────────────────────────────────────────────

async function listarCierres(req, res) {
  const { id: usuarioId, bodega_id, rol } = req.usuario;
  const { fecha_desde, fecha_hasta, bodega, page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let sql = `SELECT cc.*, u.nombre_usuario, b.nombre AS bodega_nombre
                  FROM cierre_caja cc
                  JOIN usuarios u ON u.id = cc.usuario_id
                  JOIN bodegas  b ON b.id = cc.bodega_id
                WHERE 1=1`;
    const params = [];

    if (rol === 'bodeguero') { sql += ' AND cc.usuario_id = ?'; params.push(usuarioId); }
    else if (bodega)         { sql += ' AND cc.bodega_id = ?';  params.push(bodega); }

    if (fecha_desde) { sql += ' AND cc.fecha >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { sql += ' AND cc.fecha <= ?'; params.push(fecha_hasta); }

    sql += ' ORDER BY cc.fecha DESC, cc.hora_cierre DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const cierres = await query(sql, params);
    return res.status(200).json({ cierres, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[cierreCaja.controller] listarCierres:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/cierre-caja/:id ─────────────────────────────────────────────────

async function obtenerCierre(req, res) {
  const { id } = req.params;
  const { rol, id: usuarioId } = req.usuario;

  try {
    const rows = await query(
      `SELECT cc.*, u.nombre_usuario, b.nombre AS bodega_nombre
          FROM cierre_caja cc
          JOIN usuarios u ON u.id = cc.usuario_id
          JOIN bodegas  b ON b.id = cc.bodega_id
        WHERE cc.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cierre no encontrado' });
    if (rol === 'bodeguero' && rows[0].usuario_id !== usuarioId) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    return res.status(200).json({ cierre: rows[0] });
  } catch (err) {
    console.error('[cierreCaja.controller] obtenerCierre:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { obtenerResumenCaja, cerrarCaja, listarCierres, obtenerCierre };