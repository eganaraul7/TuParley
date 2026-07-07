-- Nombre de archivo: 004_config_impresion_bodega.sql
-- Ruta: database/migrations/004_config_impresion_bodega.sql
-- Función: Config de impresión física/digital por bodega. Ambas activas por
--          defecto. modo_impresion en tickets registra cómo se emitió cada uno.

USE tuparley;

-- ── Tabla de configuración ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_impresion_bodega (
  bodega_id       INT UNSIGNED  NOT NULL,
  fisica_activa   TINYINT(1)    NOT NULL DEFAULT 1,
  digital_activa  TINYINT(1)    NOT NULL DEFAULT 1,
  actualizado_por INT UNSIGNED  NULL,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (bodega_id),
  CONSTRAINT fk_cib_bodega
    FOREIGN KEY (bodega_id)  REFERENCES bodegas(id)   ON DELETE CASCADE,
  CONSTRAINT fk_cib_usuario
    FOREIGN KEY (actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seed: poblar con todas las bodegas existentes ─────────────────────────────
INSERT IGNORE INTO config_impresion_bodega (bodega_id, fisica_activa, digital_activa)
SELECT id, 1, 1 FROM bodegas;

-- ── Campo modo_impresion en tickets ──────────────────────────────────────────
-- Registra si el ticket se emitió por impresora física o QR digital.
-- NULL = ticket creado antes de esta migración.
ALTER TABLE tickets
  ADD COLUMN modo_impresion
  ENUM('fisica', 'digital') NULL DEFAULT NULL
  AFTER estado;

-- ── Registro en schema_migrations ────────────────────────────────────────────
INSERT IGNORE INTO schema_migrations (version) VALUES ('004_config_impresion_bodega');