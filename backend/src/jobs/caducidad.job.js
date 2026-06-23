'use strict';
const cron = require('node-cron');
const { query } = require('../config/db');
// ✅ FIX: require al tope, no dentro del callback del cron
const { calcularMetricas, calcularMetricasPorBodega, guardarEstadisticasMensuales } =
  require('../services/reporte.service');

function iniciar(io) {
  // Cada 30 min: caducar tickets GANADOS sin cobrar en 48h
  cron.schedule('*/30 * * * *', async () => {
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
        WHERE id IN (${ids.map(() => '?').join(',')})`,
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
  }, { timezone: 'America/Caracas' });

  // Día 1 de cada mes 00:01 AM: estadísticas mensuales automáticas
  cron.schedule('1 0 1 * *', async () => {
    const ahora = new Date();
    const mes   = ahora.getMonth() === 0 ? 12 : ahora.getMonth();
    const anio  = ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear();
    const fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const fechaHasta = new Date(anio, mes, 0).toISOString().split('T')[0];

    const global  = await calcularMetricas(fechaDesde, fechaHasta);
    await guardarEstadisticasMensuales(mes, anio, global, null);
    const bodegas = await calcularMetricasPorBodega(fechaDesde, fechaHasta);
    for (const b of bodegas) await guardarEstadisticasMensuales(mes, anio, b, b.bodega_id);
    console.log(`[caducidad.job] Estadísticas ${mes}/${anio} generadas`);
  }, { timezone: 'America/Caracas' });

  console.log('[caducidad.job] Crons registrados → caducidad 30min | estadísticas día 1');
}

module.exports = { iniciar };