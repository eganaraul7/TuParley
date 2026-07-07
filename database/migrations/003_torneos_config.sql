-- Nombre de archivo: 003_torneos_config.sql
-- Ruta: database/migrations/003_torneos_config.sql
-- Función: Tabla de control de torneos/ligas por deporte. Activo/inactivo
--          configurable manualmente (admin) o automáticamente (sin partidos).

USE tuparley;

CREATE TABLE IF NOT EXISTS torneos_config (
  id              INT UNSIGNED  AUTO_INCREMENT,
  deporte         ENUM('futbol','baloncesto','beisbol','mma','tenis') NOT NULL,
  nombre_liga     VARCHAR(150)  NOT NULL,
  activo          TINYINT(1)    NOT NULL DEFAULT 1,
  actualizado_por INT UNSIGNED  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_torneos_deporte_liga (deporte, nombre_liga),
  INDEX idx_torneos_activo  (activo),
  INDEX idx_torneos_deporte (deporte),
  CONSTRAINT fk_torneos_usuario FOREIGN KEY (actualizado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version) VALUES ('003_torneos_config');