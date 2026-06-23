'use strict';

const { query } = require('../config/db');

const PagoModel = {
  findById: (id) =>
    query(`SELECT p.*, t.numero_serie, t.bodega_id, t.ganancia_potencial_usd, t.moneda_pago,
                  u.nombre_usuario AS pagado_por, b.nombre AS bodega_nombre
              FROM pagos p
              JOIN tickets  t ON t.id  = p.ticket_id
              JOIN usuarios u ON u.id  = p.usuario_quien_pago
              JOIN bodegas  b ON b.id  = t.bodega_id
            WHERE p.id = ? LIMIT 1`, [id]).then(r => r[0] ?? null),

  findByTicketId: (ticket_id) =>
    query(`SELECT p.*, u.nombre_usuario AS pagado_por
              FROM pagos p JOIN usuarios u ON u.id = p.usuario_quien_pago
            WHERE p.ticket_id = ? LIMIT 1`, [ticket_id]).then(r => r[0] ?? null),

  findAll: (filtros = {}, page = 1, limit = 50) => {
    const offset = (page - 1) * limit;
    let sql = `SELECT p.id, p.ticket_id, p.monto_pagado_usd, p.monto_pagado_bs,
                      p.moneda, p.tasa_bcv_pago, p.fecha_pago, p.cedula_foto_url,
                      t.numero_serie, t.bodega_id,
                      u.nombre_usuario AS pagado_por, b.nombre AS bodega_nombre
                  FROM pagos p
                  JOIN tickets  t ON t.id  = p.ticket_id
                  JOIN usuarios u ON u.id  = p.usuario_quien_pago
                  JOIN bodegas  b ON b.id  = t.bodega_id
                WHERE 1=1`;
    const params = [];
    if (filtros.bodega_id)   { sql += ' AND t.bodega_id = ?';          params.push(filtros.bodega_id); }
    if (filtros.fecha_desde) { sql += ' AND DATE(p.fecha_pago) >= ?';  params.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { sql += ' AND DATE(p.fecha_pago) <= ?';  params.push(filtros.fecha_hasta); }
    if (filtros.moneda)      { sql += ' AND p.moneda = ?';             params.push(filtros.moneda); }
    sql += ' ORDER BY p.fecha_pago DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  },

  create: (data) =>
    query(`INSERT INTO pagos (ticket_id, monto_pagado_usd, monto_pagado_bs, moneda,
              tasa_bcv_pago, usuario_quien_pago, fecha_pago, cedula_foto_url)
            VALUES (?,?,?,?,?,?,?,?)`,
      [data.ticket_id, data.monto_pagado_usd, data.monto_pagado_bs, data.moneda,
        data.tasa_bcv_pago, data.usuario_quien_pago, data.fecha_pago ?? new Date(),
        data.cedula_foto_url ?? null]),

  totalPagadoHoy: (bodega_id) =>
    query(`SELECT COALESCE(SUM(p.monto_pagado_usd), 0) AS total_usd,
                  COALESCE(SUM(p.monto_pagado_bs),  0) AS total_bs
              FROM pagos p JOIN tickets t ON t.id = p.ticket_id
            WHERE t.bodega_id = ? AND DATE(p.fecha_pago) = CURDATE()`, [bodega_id])
      .then(r => r[0]),
};

module.exports = PagoModel;