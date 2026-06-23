'use strict';
const { query } = require('../config/db');

async function calcularMetricas(fechaDesde, fechaHasta, bodega_id = null) {
  let where = 'WHERE DATE(t.fecha_creacion) BETWEEN ? AND ?';
  const params = [fechaDesde, fechaHasta];
  if (bodega_id) { where += ' AND t.bodega_id = ?'; params.push(bodega_id); }

  const [stats] = await query(
    `SELECT
        COUNT(*)                                                      AS total_tickets,
        COUNT(CASE WHEN t.estado = 'GANADO'           THEN 1 END)    AS tickets_ganados,
        COUNT(CASE WHEN t.estado = 'PERDIDO'          THEN 1 END)    AS tickets_perdidos,
        COUNT(CASE WHEN t.estado = 'SUSPENDIDO'       THEN 1 END)    AS tickets_suspendidos,
        COUNT(CASE WHEN t.estado = 'ANULADO'          THEN 1 END)    AS tickets_anulados,
        COUNT(CASE WHEN t.estado = 'CADUCADO_GANADOR' THEN 1 END)    AS tickets_caducados,
        COUNT(CASE WHEN t.estado = 'PAGADO'           THEN 1 END)    AS tickets_pagados,
        COALESCE(SUM(CASE WHEN t.estado != 'ANULADO' THEN t.monto_apostado_usd END), 0) AS total_recaudado_usd,
        COALESCE(AVG(CASE WHEN t.estado != 'ANULADO' THEN t.monto_apostado_usd END), 0) AS promedio_apuesta_usd
      FROM tickets t ${where}`, params
  );

  let wherePagos = 'WHERE DATE(p.fecha_pago) BETWEEN ? AND ?';
  const paramsPagos = [fechaDesde, fechaHasta];
  if (bodega_id) { wherePagos += ' AND t.bodega_id = ?'; paramsPagos.push(bodega_id); }
  const [pagos] = await query(
    `SELECT COALESCE(SUM(p.monto_pagado_usd), 0) AS premios_pagados_usd
        FROM pagos p JOIN tickets t ON t.id = p.ticket_id ${wherePagos}`, paramsPagos
  );

  let whereCat = 'WHERE DATE(t.fecha_creacion) BETWEEN ? AND ?';
  const paramsCat = [fechaDesde, fechaHasta];
  if (bodega_id) { whereCat += ' AND t.bodega_id = ?'; paramsCat.push(bodega_id); }
  const categorias = await query(
    `SELECT e.deporte, COUNT(*) AS cantidad
        FROM selecciones_ticket st
        JOIN tickets t ON t.id = st.ticket_id
        JOIN eventos e ON e.id = st.evento_id
      ${whereCat}
      GROUP BY e.deporte ORDER BY cantidad DESC LIMIT 1`, paramsCat
  );

  const recaudado   = parseFloat(stats.total_recaudado_usd);
  const premios     = parseFloat(pagos.premios_pagados_usd);
  const ganancia    = Math.round((recaudado - premios) * 100) / 100;

  return {
    ...stats,
    premios_pagados_usd:    premios,
    total_recaudado_usd:    recaudado,
    ganancia_bruta_usd:     ganancia,
    ganancia_operador_usd:  Math.round(ganancia * 0.80 * 100) / 100,
    ganancia_bodeguero_usd: Math.round(ganancia * 0.20 * 100) / 100,
    promedio_apuesta_usd:   Math.round(parseFloat(stats.promedio_apuesta_usd) * 100) / 100,
    categoria_mas_jugada:   categorias[0]?.deporte ?? null,
  };
}

async function calcularMetricasPorBodega(fechaDesde, fechaHasta) {
  const bodegas = await query(`SELECT id, nombre, prefijo FROM bodegas WHERE activa = 1`);
  return Promise.all(
    bodegas.map(async b => ({
      bodega_id: b.id, bodega_nombre: b.nombre, bodega_prefijo: b.prefijo,
      ...(await calcularMetricas(fechaDesde, fechaHasta, b.id)),
    }))
  );
}

async function guardarEstadisticasMensuales(mes, anio, m, bodega_id = null) {
  await query(
    `INSERT INTO estadisticas_mensuales
        (bodega_id, mes, anio, tickets_total, tickets_ganados, tickets_perdidos,
        tickets_suspendidos, tickets_caducados_ganadores, tickets_anulados,
        premios_pagados_usd, recaudado_usd, promedio_apuesta_usd, categoria_mas_jugada)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        tickets_total             = VALUES(tickets_total),
        tickets_ganados           = VALUES(tickets_ganados),
        tickets_perdidos          = VALUES(tickets_perdidos),
        tickets_suspendidos       = VALUES(tickets_suspendidos),
        tickets_caducados_ganadores = VALUES(tickets_caducados_ganadores),
        tickets_anulados          = VALUES(tickets_anulados),
        premios_pagados_usd       = VALUES(premios_pagados_usd),
        recaudado_usd             = VALUES(recaudado_usd),
        promedio_apuesta_usd      = VALUES(promedio_apuesta_usd),
        categoria_mas_jugada      = VALUES(categoria_mas_jugada),
        updated_at                = NOW()`,
    [bodega_id, mes, anio, m.total_tickets, m.tickets_ganados, m.tickets_perdidos,
      m.tickets_suspendidos, m.tickets_caducados, m.tickets_anulados,
      m.premios_pagados_usd, m.total_recaudado_usd, m.promedio_apuesta_usd,
      m.categoria_mas_jugada ?? null]
  );
}

module.exports = { calcularMetricas, calcularMetricasPorBodega, guardarEstadisticasMensuales };