'use strict';

const { query } = require('../config/db');

const TicketModel = {
  findById: (id) =>
    query(`SELECT t.*, b.nombre AS bodega_nombre, b.prefijo AS bodega_prefijo,
                  u.nombre_usuario
              FROM tickets t
              JOIN bodegas  b ON b.id = t.bodega_id
              JOIN usuarios u ON u.id = t.usuario_id
            WHERE t.id = ? LIMIT 1`, [id]).then(r => r[0] ?? null),

  findByNumeroSerie: (numero_serie) =>
    query(`SELECT t.*, b.nombre AS bodega_nombre, u.nombre_usuario
              FROM tickets t
              JOIN bodegas  b ON b.id = t.bodega_id
              JOIN usuarios u ON u.id = t.usuario_id
            WHERE t.numero_serie = ? LIMIT 1`, [numero_serie]).then(r => r[0] ?? null),

  findAll: (filtros = {}, page = 1, limit = 50) => {
    const offset = (page - 1) * limit;
    let sql = `SELECT t.id, t.numero_serie, t.bodega_id, t.usuario_id, t.monto_apostado_usd,
                      t.monto_apostado_bs, t.cuota_combinada, t.ganancia_potencial_usd,
                      t.ganancia_potencial_bs, t.estado, t.moneda_pago, t.origen,
                      t.fecha_creacion, t.fecha_estado_ganado, t.fecha_vencimiento_cobro,
                      b.nombre AS bodega_nombre, u.nombre_usuario
                  FROM tickets t
                  JOIN bodegas  b ON b.id = t.bodega_id
                  JOIN usuarios u ON u.id = t.usuario_id
                WHERE 1=1`;
    const params = [];
    if (filtros.bodega_id)   { sql += ' AND t.bodega_id = ?';            params.push(filtros.bodega_id); }
    if (filtros.usuario_id)  { sql += ' AND t.usuario_id = ?';           params.push(filtros.usuario_id); }
    if (filtros.estado)      { sql += ' AND t.estado = ?';               params.push(filtros.estado); }
    if (filtros.fecha_desde) { sql += ' AND DATE(t.fecha_creacion) >= ?';params.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { sql += ' AND DATE(t.fecha_creacion) <= ?';params.push(filtros.fecha_hasta); }
    sql += ' ORDER BY t.fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  },

  create: (data) =>
    query(`INSERT INTO tickets
              (numero_serie, bodega_id, usuario_id, monto_apostado_usd, monto_apostado_bs,
              tasa_bcv_dia, cuota_combinada, ganancia_potencial_usd, ganancia_potencial_bs,
              estado, moneda_pago, origen, sincronizado, hash_sha256, fecha_creacion)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [data.numero_serie, data.bodega_id, data.usuario_id, data.monto_apostado_usd,
        data.monto_apostado_bs, data.tasa_bcv_dia, data.cuota_combinada,
        data.ganancia_potencial_usd, data.ganancia_potencial_bs,
        data.estado ?? 'PENDIENTE', data.moneda_pago, data.origen ?? 'online',
        data.sincronizado ?? 1, data.hash_sha256, data.fecha_creacion ?? new Date()]),

  updateEstado: (id, estado, extras = {}) => {
    const campos = ['estado = ?'];
    const params = [estado];
    if (extras.fecha_estado_ganado)    { campos.push('fecha_estado_ganado = ?');    params.push(extras.fecha_estado_ganado); }
    if (extras.fecha_vencimiento_cobro){ campos.push('fecha_vencimiento_cobro = ?');params.push(extras.fecha_vencimiento_cobro); }
    if (extras.fecha_cobro)            { campos.push('fecha_cobro = ?');            params.push(extras.fecha_cobro); }
    params.push(id);
    return query(`UPDATE tickets SET ${campos.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
  },

  getSelecciones: (ticket_id) =>
    query(`SELECT st.*, e.equipo_local, e.equipo_visitante, e.liga, e.deporte,
                  e.fecha_inicio, e.estado AS evento_estado, e.resultado_final,
                  m.nombre AS modalidad_nombre, m.descripcion AS modalidad_descripcion
              FROM selecciones_ticket st
              JOIN eventos    e ON e.id = st.evento_id
              JOIN modalidades m ON m.id = st.modalidad_id
            WHERE st.ticket_id = ?`, [ticket_id]),

  insertSeleccion: (data) =>
    query(`INSERT INTO selecciones_ticket (ticket_id, evento_id, modalidad_id, cuota_aplicada, seleccion, resultado)
            VALUES (?,?,?,?,?,?)`,
      [data.ticket_id, data.evento_id, data.modalidad_id, data.cuota_aplicada, data.seleccion, 'pendiente']),

  updateResultadoSeleccion: (ticket_id, evento_id, resultado) =>
    query(`UPDATE selecciones_ticket SET resultado = ? WHERE ticket_id = ? AND evento_id = ?`,
      [resultado, ticket_id, evento_id]),

  existeNumeroSerie: (numero_serie) =>
    query(`SELECT id FROM tickets WHERE numero_serie = ? LIMIT 1`, [numero_serie]).then(r => r.length > 0),

  ticketsGanadosSinCobrar: () =>
    query(`SELECT id, numero_serie, bodega_id, ganancia_potencial_usd, fecha_vencimiento_cobro
              FROM tickets
            WHERE estado = 'GANADO' AND fecha_vencimiento_cobro <= NOW()`),
};

module.exports = TicketModel;