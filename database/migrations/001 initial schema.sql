-- ============================================================
-- TuParley: Migration 001 — Initial Schema
-- Archivo: database/migrations/001_initial_schema.sql
-- Ejecutar: mysql -u root -p tuparley < migrations/001_initial_schema.sql
-- ============================================================

USE tuparley;

-- Este archivo es el punto de partida del sistema de migraciones.
-- Ejecuta schema.sql y seeds.sql en orden.
-- Para proyectos nuevos: usa directamente schema.sql + seeds.sql

-- Verifica si esta migración ya fue ejecutada
SET @migration_exists = (
  SELECT COUNT(*) FROM schema_migrations WHERE version = '001_initial_schema'
);

-- Registro en tabla de control
INSERT IGNORE INTO schema_migrations (version) VALUES ('001_initial_schema');