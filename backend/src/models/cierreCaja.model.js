'use strict';

const { query } = require('../config/db');

const CierreCajaModel = {
  findById: (id) =>
    query(`SELECT cc.*, u.nombre_usuario, b.nombre AS bodega_nombre
              FROM cierre_caja cc
              JOIN usuarios u ON u.id = cc.usuario_id
              JOIN bodegas  b ON b.id = cc.bodega_id
            WHERE cc.id = ? LIMIT 1`, [id]).then(r => r[0] ?? null),

  findByUsuarioYFecha: (usuario_id, fecha) =>
    query(`SELECT * FROM cierre_caja WHERE usuario_id = ? AND fecha = ? LIMIT 1`,
      [usuario_id, fecha]).then(r => r[0] ?? null),

  findAll: (filtros = {}, page = 1, limit = 30) => {
    const offset = (page - 1) * limit;
    let sql = `SELECT cc.*, u.nombre_usuario, b.nombre AS bodega_nombre
                  FROM cierre_caja cc
                  JOIN usuarios u ON u.id = cc.usuario_id
                  JOIN bodegas  b ON b.id = cc.bodega_id
                WHERE 1=1`;
    const params = [];
    if (filtros.usuario_id)  { sql += ' AND cc.usuario_id = ?';  params.push(filtros.usuario_id); }
    if (filtros.bodega_id)   { sql += ' AND cc.bodega_id = ?';   params.push(filtros.bodega_id); }
    if (filtros.fecha_desde) { sql += ' AND cc.fecha >= ?';      params.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { sql += ' AND cc.fecha <= ?';      params.push(filtros.fecha_hasta); }
    sql += ' ORDER BY cc.fecha DESC, cc.hora_cierre DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  },

  create: (data) =>
    query(`INSERT INTO cierre_caja
              (usuario_id, bodega_id, fecha, tickets_vendidos, tickets_anulados,
              premios_pagados_usd, total_bs_declarado, total_usd_declarado,
              total_calculado_bs, total_calculado_usd,
              discrepancia_usd, discrepancia_bs, hay_discrepancia,
              hora_apertura, hora_cierre)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [data.usuario_id, data.bodega_id, data.fecha,
        data.tickets_vendidos, data.tickets_anulados, data.premios_pagados_usd,
        data.total_bs_declarado, data.total_usd_declarado,
        data.total_calculado_bs, data.total_calculado_usd,
        data.discrepancia_usd, data.discrepancia_bs, data.hay_discrepancia,
        data.hora_apertura, data.hora_cierre]),

  calcularTotalesDia: async (usuario_id, fecha) => {
    const [tickets] = await query(
      `SELECT COUNT(*) AS tickets_vendidos,
              COUNT(CASE WHEN estado = 'ANULADO' THEN 1 END) AS tickets_anulados,
              COALESCE(SUM(CASE WHEN estado != 'ANULADO' THEN monto_apostado_usd ELSE 0 END), 0) AS total_usd,
              COALESCE(SUM(CASE WHEN estado != 'ANULADO' THEN monto_apostado_bs  ELSE 0 END), 0) AS total_bs
          FROM tickets WHERE usuario_id = ? AND DATE(fecha_creacion) = ?`, [usuario_id, fecha]);
    const [pagos] = await query(
      `SELECT COALESCE(SUM(p.monto_pagado_usd), 0) AS premios_usd,
              COALESCE(SUM(p.monto_pagado_bs),  0) AS premios_bs
          FROM pagos p JOIN tickets t ON t.id = p.ticket_id
        WHERE t.usuario_id = ? AND DATE(p.fecha_pago) = ?`, [usuario_id, fecha]);
    return {
      tickets_vendidos:    tickets.tickets_vendidos,
      tickets_anulados:    tickets.tickets_anulados,
      total_calculado_usd: parseFloat(tickets.total_usd),
      total_calculado_bs:  parseFloat(tickets.total_bs),
      premios_pagados_usd: parseFloat(pagos.premios_usd),
      premios_pagados_bs:  parseFloat(pagos.premios_bs),
    };
  },

  tieneDiscrepancias: () =>
    query(`SELECT cc.*, u.nombre_usuario, b.nombre AS bodega_nombre
              FROM cierre_caja cc
              JOIN usuarios u ON u.id = cc.usuario_id
              JOIN bodegas  b ON b.id = cc.bodega_id
            WHERE cc.hay_discrepancia = 1
            ORDER BY cc.fecha DESC LIMIT 50`),
};

module.exports = CierreCajaModel;