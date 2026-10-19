'use strict';
const cron = require('node-cron');
const { query } = require('../config/db');
// ✅ FIX: require al tope, no dentro del callback del cron
const { calcularMetricas, calcularMetricasPorBodega, guardarEstadisticasMensuales } =
  require('../services/reporte.service');
const { mesActualVET, rangoMes } = require('../utils/fecha');
const { tarea } = require('./deportes.job');

function iniciar(io) {
  // Cada 30 min: caducar tickets GANADOS sin cobrar en 48h
  cron.schedule('*/30 * * * *', tarea('caducidad', async () => {
    const tickets = await query(
      `SELECT id, numero_serie, bodega_id, ganancia_potencial_usd
        FROM tickets
        WHERE estado = 'GANADO'
          AND fecha_vencimiento_cobro IS NOT NULL
          AND fecha_vencimiento_cobro <= NOW()`
    );
    if (tickets.length === 0) return;

    const ids = tickets.map(t => t.id);
    await query(
      `UPDATE tickets SET estado = 'CADUCADO_GANADOR', updated_at = NOW()
        WHERE estado = 'GANADO' AND id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    for (const t of tickets) {
      await query(
        `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
        VALUES ('ticket_caducado_ganador',
                CONCAT('Ticket ', ?, ' superó 48h sin cobrar → CADUCADO_GANADOR ($', ?, ')'),
                'ambos', ?, 'tickets')`,
        [t.numero_serie, t.ganancia_potencial_usd, t.id]
      );
      io?.to('admins').emit('ticket_caducado', { serie: t.numero_serie, ticketId: t.id });
    }
    console.log(`[caducidad.job] ${tickets.length} ticket(s) → CADUCADO_GANADOR`);
  }), { timezone: 'America/Caracas' });

  // Día 1 de cada mes 00:01 AM: estadísticas mensuales automáticas
  cron.schedule('1 0 1 * *', tarea('estadisticas', async () => {
    // Mes anterior al actual (VET)
    const actual = mesActualVET();
    const mes    = actual.mes === 1 ? 12 : actual.mes - 1;
    const anio   = actual.mes === 1 ? actual.anio - 1 : actual.anio;
    const { desde: fechaDesde, hasta: fechaHasta } = rangoMes(mes, anio);

    const global  = await calcularMetricas(fechaDesde, fechaHasta);
    await guardarEstadisticasMensuales(mes, anio, global, null);
    const bodegas = await calcularMetricasPorBodega(fechaDesde, fechaHasta);
    for (const b of bodegas) await guardarEstadisticasMensuales(mes, anio, b, b.bodega_id);
    console.log(`[caducidad.job] Estadísticas ${mes}/${anio} generadas`);
  }), { timezone: 'America/Caracas' });

  console.log('[caducidad.job] Crons registrados → caducidad 30min | estadísticas día 1');
}

module.exports = { iniciar };