'use strict';

const { query } = require('../config/db');

// ─── GET /api/pagos ───────────────────────────────────────────────────────────

async function listarPagos(req, res) {
  const { rol, id: usuarioId, bodega_id } = req.usuario;
  const { fecha_desde, fecha_hasta, moneda, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let sql = `SELECT p.id, p.ticket_id, p.monto_pagado_usd, p.monto_pagado_bs,
                      p.moneda, p.tasa_bcv_pago, p.fecha_pago,
                      p.cedula_foto_url,
                      t.numero_serie, t.bodega_id, t.ganancia_potencial_usd,
                      u_pago.nombre_usuario AS pagado_por,
                      b.nombre AS bodega_nombre
                  FROM pagos p
                  JOIN tickets  t      ON t.id  = p.ticket_id
                  JOIN usuarios u_pago ON u_pago.id = p.usuario_quien_pago
                  JOIN bodegas  b      ON b.id  = t.bodega_id
                WHERE 1=1`;
    const params = [];

    if (rol === 'bodeguero') { sql += ' AND t.bodega_id = ?'; params.push(bodega_id); }
    if (fecha_desde) { sql += ' AND DATE(p.fecha_pago) >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { sql += ' AND DATE(p.fecha_pago) <= ?'; params.push(fecha_hasta); }
    if (moneda)      { sql += ' AND p.moneda = ?';            params.push(moneda); }

    sql += ' ORDER BY p.fecha_pago DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const pagos = await query(sql, params);

    // Totales del filtro actual
    let sqlTotales = `SELECT
          COALESCE(SUM(p.monto_pagado_usd), 0) AS total_pagado_usd,
          COALESCE(SUM(p.monto_pagado_bs),  0) AS total_pagado_bs,
          COUNT(*) AS cantidad_pagos
        FROM pagos p
        JOIN tickets t ON t.id = p.ticket_id
      WHERE 1=1`;
    const paramsTotales = [];
    if (rol === 'bodeguero') { sqlTotales += ' AND t.bodega_id = ?'; paramsTotales.push(bodega_id); }
    if (fecha_desde) { sqlTotales += ' AND DATE(p.fecha_pago) >= ?'; paramsTotales.push(fecha_desde); }
    if (fecha_hasta) { sqlTotales += ' AND DATE(p.fecha_pago) <= ?'; paramsTotales.push(fecha_hasta); }
    if (moneda)      { sqlTotales += ' AND p.moneda = ?';            paramsTotales.push(moneda); }

    const [totales] = await query(sqlTotales, paramsTotales);

    return res.status(200).json({ pagos, totales, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[pago.controller] listarPagos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/pagos/:id ───────────────────────────────────────────────────────

async function obtenerPago(req, res) {
  const { id } = req.params;
  const { rol, bodega_id } = req.usuario;

  try {
    const rows = await query(
      `SELECT p.*, t.numero_serie, t.bodega_id, t.monto_apostado_usd,
              t.ganancia_potencial_usd, t.moneda_pago,
              u_pago.nombre_usuario AS pagado_por,
              b.nombre AS bodega_nombre
          FROM pagos p
          JOIN tickets  t      ON t.id  = p.ticket_id
          JOIN usuarios u_pago ON u_pago.id = p.usuario_quien_pago
          JOIN bodegas  b      ON b.id  = t.bodega_id
        WHERE p.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
    if (rol === 'bodeguero' && rows[0].bodega_id !== bodega_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    return res.status(200).json({ pago: rows[0] });
  } catch (err) {
    console.error('[pago.controller] obtenerPago:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/pagos/ticket/:ticketId ─────────────────────────────────────────

async function obtenerPagoPorTicket(req, res) {
  const { ticketId } = req.params;
  const { rol, bodega_id } = req.usuario;

  try {
    const rows = await query(
      `SELECT p.*, t.numero_serie, t.bodega_id,
              u_pago.nombre_usuario AS pagado_por
          FROM pagos p
          JOIN tickets  t      ON t.id  = p.ticket_id
          JOIN usuarios u_pago ON u_pago.id = p.usuario_quien_pago
        WHERE p.ticket_id = ? LIMIT 1`,
      [ticketId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado para este ticket' });
    if (rol === 'bodeguero' && rows[0].bodega_id !== bodega_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    return res.status(200).json({ pago: rows[0] });
  } catch (err) {
    console.error('[pago.controller] obtenerPagoPorTicket:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listarPagos, obtenerPago, obtenerPagoPorTicket };