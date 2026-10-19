-- ============================================================
-- TuParley: Migration 007 — Resultados estructurados y reembolsos
-- Archivo: database/migrations/007_resultados_reembolso.sql
-- Descripción:
--   1. tickets.estado agrega REEMBOLSADO (devolución de tickets SUSPENDIDO).
--   2. pagos.tipo distingue premio pagado de reembolso.
--   3. eventos guarda ganador y detalle de fin para liquidar
--      marcador exacto, tiempo extra/penales y método MMA.
--   4. Índice (deporte, api_evento_id): los IDs de API-Sports solo son
--      únicos dentro de cada deporte.
--   5. Nuevos tipos de notificación.
-- No elimina ni modifica datos existentes.
-- ============================================================

USE tuparley;

ALTER TABLE tickets
  MODIFY COLUMN estado
    ENUM('PENDIENTE','GANADO','PERDIDO','PAGADO','ANULADO','SUSPENDIDO','CADUCADO_GANADOR','REEMBOLSADO')
    NOT NULL DEFAULT 'PENDIENTE';

ALTER TABLE pagos
  ADD COLUMN tipo ENUM('premio','reembolso') NOT NULL DEFAULT 'premio' AFTER ticket_id;

ALTER TABLE eventos
  ADD COLUMN ganador_final ENUM('local','empate','visitante') NULL AFTER resultado_final,
  ADD COLUMN detalle_fin_final
    ENUM('tiempo_extra','penales','ko','tko','sumision','decision') NULL AFTER ganador_final,
  ADD INDEX idx_eventos_deporte_api (deporte, api_evento_id);

ALTER TABLE notificaciones
  MODIFY COLUMN tipo ENUM(
    'usuario_bloqueado',
    'solicitud_reingreso',
    'premio_alto_pagado',
    'ticket_caducado_ganador',
    'solicitud_anulacion',
    'discrepancia_caja',
    'evento_suspendido',
    'api_bcv_caida',
    'ticket_ganador',
    'resultado_manual',
    'ticket_reembolsado',
    'ticket_offline_rechazado'
  ) NOT NULL;

INSERT IGNORE INTO schema_migrations (version) VALUES ('007_resultados_reembolso');
