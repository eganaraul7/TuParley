-- ============================================================
-- TuParley: Migration 002 — Índices adicionales de rendimiento
-- Archivo: database/migrations/002_additional_indexes.sql
-- ============================================================

USE tuparley;

-- Índice compuesto para búsqueda de tickets por bodega + estado (historial bodeguero)
ALTER TABLE tickets
  ADD INDEX idx_tickets_bodega_estado (bodega_id, estado),
  ADD INDEX idx_tickets_bodega_fecha  (bodega_id, fecha_creacion);

-- Índice compuesto para búsqueda de eventos por deporte + fecha (listado principal)
ALTER TABLE eventos
  ADD INDEX idx_eventos_deporte_fecha (deporte, fecha_inicio, estado);

-- Índice para notificaciones no leídas por rol (panel admin)
ALTER TABLE notificaciones
  ADD INDEX idx_notificaciones_rol_leido (destinatario_rol, leido, created_at);

-- Índice para auditoría por entidad afectada
ALTER TABLE auditoria_logs
  ADD INDEX idx_auditoria_entidad (entidad_afectada, entidad_id);

-- Índice para cierre de caja por bodega y fecha
ALTER TABLE cierre_caja
  ADD INDEX idx_cierre_caja_bodega_fecha (bodega_id, fecha);

INSERT IGNORE INTO schema_migrations (version) VALUES ('002_additional_indexes');