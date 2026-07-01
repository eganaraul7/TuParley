-- ============================================================
-- TuParley: Sistema de Apuestas Deportivas
-- Archivo: database/schema.sql
-- Motor: MySQL 8.0
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- Zona horaria: -04:00 (Venezuela VET)
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-04:00';
SET foreign_key_checks = 0;

CREATE DATABASE IF NOT EXISTS tuparley
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tuparley;

-- ============================================================
-- TABLA: schema_migrations
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version      VARCHAR(20) NOT NULL,
  ejecutado_en DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: bodegas
-- ============================================================
CREATE TABLE IF NOT EXISTS bodegas (
  id         INT UNSIGNED  AUTO_INCREMENT,
  nombre     VARCHAR(100)  NOT NULL,
  ubicacion  VARCHAR(255)  NULL,
  prefijo    VARCHAR(5)    NOT NULL,
  activa     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bodegas_prefijo (prefijo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id                   INT UNSIGNED     AUTO_INCREMENT,
  nombre_usuario       VARCHAR(50)      NOT NULL,
  contrasena_hash      VARCHAR(255)     NOT NULL,
  rol                  ENUM('computadora_madre','administrador','bodeguero','desconocido') NOT NULL DEFAULT 'desconocido',
  bodega_id            INT UNSIGNED     NULL,
  bloqueado            TINYINT(1)       NOT NULL DEFAULT 0,
  intentos_fallidos    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  sesion_activa        TINYINT(1)       NOT NULL DEFAULT 0,
  hora_apertura_sesion DATETIME         NULL,
  ultimo_login         DATETIME         NULL,
  totp_secret          VARCHAR(64)      NULL,
  totp_habilitado      TINYINT(1)       NOT NULL DEFAULT 0,
  created_at           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_nombre_usuario (nombre_usuario),
  CONSTRAINT fk_usuarios_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: configuracion_sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  clave           VARCHAR(100) NOT NULL,
  valor           VARCHAR(500) NOT NULL,
  descripcion     VARCHAR(255) NULL,
  actualizado_por INT UNSIGNED NULL,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave),
  CONSTRAINT fk_config_usuario FOREIGN KEY (actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: tasa_bcv
-- ============================================================
CREATE TABLE IF NOT EXISTS tasa_bcv (
  id              INT UNSIGNED  AUTO_INCREMENT,
  valor           DECIMAL(10,4) NOT NULL,
  fuente          ENUM('api','manual') NOT NULL DEFAULT 'api',
  validada        TINYINT(1)    NOT NULL DEFAULT 0,
  actualizado_por INT UNSIGNED  NULL,
  fecha           DATE          NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_tasa_bcv_fecha (fecha),
  CONSTRAINT fk_tasa_bcv_usuario FOREIGN KEY (actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: categorias_config
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias_config (
  deporte         ENUM('futbol','baloncesto','beisbol','caballos','tenis') NOT NULL,
  activa          TINYINT(1)   NOT NULL DEFAULT 1,
  actualizado_por INT UNSIGNED NULL,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (deporte),
  CONSTRAINT fk_categorias_config_usuario FOREIGN KEY (actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: eventos
-- ============================================================
CREATE TABLE IF NOT EXISTS eventos (
  id               INT UNSIGNED  AUTO_INCREMENT,
  api_evento_id    VARCHAR(100)  NULL,
  deporte          ENUM('futbol','baloncesto','beisbol','caballos','tenis') NOT NULL,
  liga             VARCHAR(150)  NOT NULL,
  equipo_local     VARCHAR(150)  NOT NULL,
  equipo_visitante VARCHAR(150)  NOT NULL,
  fecha_inicio     DATETIME      NOT NULL,
  estado           ENUM('programado','en_curso','finalizado','suspendido','cancelado') NOT NULL DEFAULT 'programado',
  resultado_final  VARCHAR(100)  NULL,
  activo           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_eventos_deporte     (deporte),
  INDEX idx_eventos_fecha_inicio (fecha_inicio),
  INDEX idx_eventos_estado      (estado),
  INDEX idx_eventos_api_id      (api_evento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: modalidades
-- ============================================================
CREATE TABLE IF NOT EXISTS modalidades (
  id           INT UNSIGNED AUTO_INCREMENT,
  deporte      ENUM('futbol','baloncesto','beisbol','caballos','tenis') NOT NULL,
  nombre       VARCHAR(100) NOT NULL,
  descripcion  TEXT         NOT NULL,
  cuota_minima DECIMAL(8,2) NOT NULL,
  cuota_maxima DECIMAL(8,2) NOT NULL,
  cuota_base   DECIMAL(8,2) NOT NULL,
  dificultad   ENUM('facil','facil_media','media','media_dificil','dificil','muy_dificil') NOT NULL,
  activa       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_modalidades_deporte (deporte),
  INDEX idx_modalidades_activa  (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id                      INT UNSIGNED  AUTO_INCREMENT,
  numero_serie            VARCHAR(20)   NOT NULL,
  bodega_id               INT UNSIGNED  NOT NULL,
  usuario_id              INT UNSIGNED  NOT NULL,
  monto_apostado_usd      DECIMAL(10,2) NOT NULL,
  monto_apostado_bs       DECIMAL(14,2) NOT NULL,
  tasa_bcv_dia            DECIMAL(10,4) NOT NULL,
  cuota_combinada         DECIMAL(12,4) NOT NULL,
  ganancia_potencial_usd  DECIMAL(10,2) NOT NULL,
  ganancia_potencial_bs   DECIMAL(14,2) NOT NULL,
  estado                  ENUM('PENDIENTE','GANADO','PERDIDO','PAGADO','ANULADO','SUSPENDIDO','CADUCADO_GANADOR') NOT NULL DEFAULT 'PENDIENTE',
  moneda_pago             ENUM('USD','BS') NOT NULL,
  origen                  ENUM('online','offline') NOT NULL DEFAULT 'online',
  sincronizado            TINYINT(1)    NOT NULL DEFAULT 1,
  hash_sha256             VARCHAR(64)   NOT NULL,
  fecha_creacion          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_estado_ganado     DATETIME      NULL,
  fecha_vencimiento_cobro DATETIME      NULL,
  fecha_cobro             DATETIME      NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_numero_serie (numero_serie),
  UNIQUE KEY uq_tickets_hash_sha256  (hash_sha256),
  INDEX idx_tickets_estado         (estado),
  INDEX idx_tickets_bodega_id      (bodega_id),
  INDEX idx_tickets_usuario_id     (usuario_id),
  INDEX idx_tickets_fecha_creacion (fecha_creacion),
  INDEX idx_tickets_vencimiento    (fecha_vencimiento_cobro),
  CONSTRAINT fk_tickets_bodega  FOREIGN KEY (bodega_id)  REFERENCES bodegas(id),
  CONSTRAINT fk_tickets_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: selecciones_ticket
-- ============================================================
CREATE TABLE IF NOT EXISTS selecciones_ticket (
  id             INT UNSIGNED AUTO_INCREMENT,
  ticket_id      INT UNSIGNED NOT NULL,
  evento_id      INT UNSIGNED NOT NULL,
  modalidad_id   INT UNSIGNED NOT NULL,
  cuota_aplicada DECIMAL(8,2) NOT NULL,
  seleccion      VARCHAR(100) NOT NULL,
  resultado      ENUM('pendiente','ganado','perdido','suspendido') NOT NULL DEFAULT 'pendiente',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_seleccion_ticket_evento (ticket_id, evento_id),
  INDEX idx_selecciones_ticket_id (ticket_id),
  INDEX idx_selecciones_evento_id (evento_id),
  CONSTRAINT fk_selecciones_ticket    FOREIGN KEY (ticket_id)    REFERENCES tickets(id)    ON DELETE CASCADE,
  CONSTRAINT fk_selecciones_evento    FOREIGN KEY (evento_id)    REFERENCES eventos(id),
  CONSTRAINT fk_selecciones_modalidad FOREIGN KEY (modalidad_id) REFERENCES modalidades(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: pagos
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id                 INT UNSIGNED  AUTO_INCREMENT,
  ticket_id          INT UNSIGNED  NOT NULL,
  monto_pagado_usd   DECIMAL(10,2) NOT NULL,
  monto_pagado_bs    DECIMAL(14,2) NOT NULL,
  moneda             ENUM('USD','BS') NOT NULL,
  tasa_bcv_pago      DECIMAL(10,4) NOT NULL,
  usuario_quien_pago INT UNSIGNED  NOT NULL,
  fecha_pago         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pagos_ticket_id (ticket_id),
  CONSTRAINT fk_pagos_ticket  FOREIGN KEY (ticket_id)          REFERENCES tickets(id),
  CONSTRAINT fk_pagos_usuario FOREIGN KEY (usuario_quien_pago) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: solicitudes_anulacion
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitudes_anulacion (
  id             INT UNSIGNED AUTO_INCREMENT,
  ticket_id      INT UNSIGNED NOT NULL,
  solicitado_por INT UNSIGNED NOT NULL,
  motivo         TEXT         NOT NULL,
  estado         ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  revisado_por   INT UNSIGNED NULL,
  fecha_revision DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sol_anulacion_estado (estado),
  INDEX idx_sol_anulacion_ticket (ticket_id),
  CONSTRAINT fk_sol_anulacion_ticket    FOREIGN KEY (ticket_id)      REFERENCES tickets(id),
  CONSTRAINT fk_sol_anulacion_solicitante FOREIGN KEY (solicitado_por) REFERENCES usuarios(id),
  CONSTRAINT fk_sol_anulacion_revisor   FOREIGN KEY (revisado_por)   REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: cierre_caja
-- ============================================================
CREATE TABLE IF NOT EXISTS cierre_caja (
  id                  INT UNSIGNED   AUTO_INCREMENT,
  usuario_id          INT UNSIGNED   NOT NULL,
  bodega_id           INT UNSIGNED   NOT NULL,
  fecha               DATE           NOT NULL,
  tickets_vendidos    INT UNSIGNED   NOT NULL DEFAULT 0,
  tickets_anulados    INT UNSIGNED   NOT NULL DEFAULT 0,
  premios_pagados_usd DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  total_bs_declarado  DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  total_usd_declarado DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  total_calculado_bs  DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  total_calculado_usd DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  discrepancia_usd    DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  discrepancia_bs     DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  hay_discrepancia    TINYINT(1)     NOT NULL DEFAULT 0,
  hora_apertura       DATETIME       NOT NULL,
  hora_cierre         DATETIME       NOT NULL,
  created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cierre_caja_usuario_fecha (usuario_id, fecha),
  INDEX idx_cierre_caja_bodega (bodega_id),
  CONSTRAINT fk_cierre_caja_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_cierre_caja_bodega  FOREIGN KEY (bodega_id)  REFERENCES bodegas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: auditoria_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria_logs (
  id               BIGINT UNSIGNED AUTO_INCREMENT,
  usuario_id       INT UNSIGNED    NULL,
  accion           VARCHAR(100)    NOT NULL,
  entidad_afectada VARCHAR(50)     NULL,
  entidad_id       INT UNSIGNED    NULL,
  detalle          JSON            NULL,
  ip_address       VARCHAR(45)     NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_auditoria_usuario    (usuario_id),
  INDEX idx_auditoria_accion     (accion),
  INDEX idx_auditoria_created_at (created_at),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: notificaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id               INT UNSIGNED AUTO_INCREMENT,
  tipo             ENUM(
                      'usuario_bloqueado',
                      'solicitud_reingreso',
                      'premio_alto_pagado',
                      'ticket_caducado_ganador',
                      'solicitud_anulacion',
                      'discrepancia_caja',
                      'evento_suspendido',
                      'api_bcv_caida',
                      'ticket_ganador'
                    ) NOT NULL,
  mensaje          TEXT         NOT NULL,
  leido            TINYINT(1)   NOT NULL DEFAULT 0,
  destinatario_rol ENUM('computadora_madre','administrador','ambos') NOT NULL DEFAULT 'ambos',
  referencia_id    INT UNSIGNED NULL,
  referencia_tipo  VARCHAR(50)  NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_notificaciones_leido      (leido),
  INDEX idx_notificaciones_tipo       (tipo),
  INDEX idx_notificaciones_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: solicitudes_reingreso
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitudes_reingreso (
  id             INT UNSIGNED AUTO_INCREMENT,
  usuario_id     INT UNSIGNED NOT NULL,
  hora_solicitud DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado         ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  revisado_por   INT UNSIGNED NULL,
  fecha_revision DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sol_reingreso_usuario (usuario_id),
  INDEX idx_sol_reingreso_estado  (estado),
  CONSTRAINT fk_sol_reingreso_usuario FOREIGN KEY (usuario_id)   REFERENCES usuarios(id),
  CONSTRAINT fk_sol_reingreso_revisor FOREIGN KEY (revisado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLA: estadisticas_mensuales
-- ============================================================
CREATE TABLE IF NOT EXISTS estadisticas_mensuales (
  id                          INT UNSIGNED      AUTO_INCREMENT,
  bodega_id                   INT UNSIGNED      NULL,
  mes                         TINYINT UNSIGNED  NOT NULL,
  anio                        SMALLINT UNSIGNED NOT NULL,
  tickets_total               INT UNSIGNED      NOT NULL DEFAULT 0,
  tickets_ganados             INT UNSIGNED      NOT NULL DEFAULT 0,
  tickets_perdidos            INT UNSIGNED      NOT NULL DEFAULT 0,
  tickets_suspendidos         INT UNSIGNED      NOT NULL DEFAULT 0,
  tickets_caducados_ganadores INT UNSIGNED      NOT NULL DEFAULT 0,
  tickets_anulados            INT UNSIGNED      NOT NULL DEFAULT 0,
  premios_pagados_usd         DECIMAL(12,2)     NOT NULL DEFAULT 0.00,
  recaudado_usd               DECIMAL(12,2)     NOT NULL DEFAULT 0.00,
  promedio_apuesta_usd        DECIMAL(10,2)     NOT NULL DEFAULT 0.00,
  categoria_mas_jugada        ENUM('futbol','baloncesto','beisbol','caballos','tenis') NULL,
  created_at                  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_estadisticas_bodega_mes_anio (bodega_id, mes, anio),
  CONSTRAINT fk_estadisticas_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;

INSERT IGNORE INTO schema_migrations (version) VALUES ('001_initial_schema');