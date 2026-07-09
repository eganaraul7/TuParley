-- ============================================================
-- TuParley: Migration 005 — Sistema de Resultado Exacto
-- Archivo: database/migrations/005_resultado_exacto.sql
-- Descripción:
--   Extiende el sistema de apuestas para soportar:
--   1. Tres botones por evento: local | empate | visitante
--   2. Marcador exacto OPCIONAL por deporte (incrementa cuota)
--   3. Detalle de fin OPCIONAL en eliminatorias (tiempo extra / penales)
--   4. Métodos de victoria en MMA (KO, TKO, sumisión, decisión)
--   5. Tipo de fase por evento (amistoso / fase_grupos / eliminatoria)
-- ============================================================

USE tuparley;

-- ============================================================
-- PARTE 1: MODIFICAR TABLA eventos
-- Agrega tipo_fase para saber si el partido puede ir a tiempo
-- extra o penales (solo en fase eliminatoria).
-- ============================================================

ALTER TABLE eventos
  ADD COLUMN tipo_fase
    ENUM('amistoso', 'fase_grupos', 'eliminatoria')
    NOT NULL
    DEFAULT 'amistoso'
  AFTER estado;

-- ============================================================
-- PARTE 2: MODIFICAR TABLA selecciones_ticket
-- Se agregan 6 columnas nuevas al final de la tabla.
-- Las existentes (seleccion, cuota_aplicada, resultado)
-- NO se tocan para mantener compatibilidad con tickets viejos.
--
-- Flujo de cuotas:
--   cuota_total = cuota_aplicada × cuota_marcador × cuota_detalle
--
-- cuota_marcador = 1.00 si no eligió marcador (no multiplica)
-- cuota_detalle  = 1.00 si no eligió detalle  (no multiplica)
-- cuota_total    se calcula automáticamente por MySQL (GENERATED)
-- ============================================================

ALTER TABLE selecciones_ticket
  -- ¿Cuál de los 3 botones eligió? (local / empate / visitante)
  -- 'no_aplica' para modalidades antiguas (over/under, handicap, etc.)
  ADD COLUMN tipo_resultado
    ENUM('local', 'empate', 'visitante', 'no_aplica')
    NOT NULL
    DEFAULT 'no_aplica'
  AFTER seleccion,

  -- Marcador OPCIONAL — NULL significa que el usuario no lo eligió.
  -- Fútbol/Béisbol: cantidad de goles/carreras de cada equipo.
  -- Tenis:          sets ganados por cada jugador (ej: 2 - 1).
  -- Baloncesto:     rango de diferencia (ver cuotas_marcador.tipo_marcador).
  -- MMA:            no aplica (usa detalle_fin en su lugar).
  ADD COLUMN marcador_local     TINYINT UNSIGNED NULL AFTER tipo_resultado,
  ADD COLUMN marcador_visitante TINYINT UNSIGNED NULL AFTER marcador_local,

  -- Detalle de fin OPCIONAL — NULL significa que el usuario no lo eligió.
  -- Fútbol (eliminatoria + empate): tiempo_extra | penales
  -- MMA (con ganador):              ko | tko | sumision | decision
  ADD COLUMN detalle_fin
    ENUM('tiempo_extra', 'penales', 'ko', 'tko', 'sumision', 'decision')
    NULL
  AFTER marcador_visitante,

  -- Multiplicador por elegir marcador exacto (1.00 = sin marcador)
  ADD COLUMN cuota_marcador DECIMAL(6,2) NOT NULL DEFAULT 1.00
  AFTER detalle_fin,

  -- Multiplicador por elegir detalle de fin (1.00 = sin detalle)
  ADD COLUMN cuota_detalle DECIMAL(6,2) NOT NULL DEFAULT 1.00
  AFTER cuota_marcador,

  -- Cuota total calculada automáticamente por MySQL.
  -- El backend usa este campo para calcular cuota_combinada del ticket.
  -- OJO: campo GENERADO — no insertar ni actualizar manualmente.
  ADD COLUMN cuota_total
    DECIMAL(10,4)
    GENERATED ALWAYS AS (cuota_aplicada * cuota_marcador * cuota_detalle)
    STORED
  AFTER cuota_detalle;

-- Índice útil para reportes por tipo de resultado
CREATE INDEX idx_selecciones_tipo_resultado
  ON selecciones_ticket (tipo_resultado);

-- ============================================================
-- PARTE 3: TABLA cuotas_marcador
-- Catálogo de multiplicadores por marcador exacto.
-- El backend consulta esta tabla para obtener cuota_marcador
-- cuando el usuario selecciona un marcador opcional.
--
-- tipo_marcador:
--   'exacto'       → fútbol, béisbol, tenis (marcador_local y
--                    marcador_visitante = puntaje real de cada equipo)
--   'rango_margen' → baloncesto (marcador_local = límite inferior
--                    de la diferencia, marcador_visitante = límite
--                    superior. Ej: 6-10 pts de diferencia)
-- ============================================================

CREATE TABLE IF NOT EXISTS cuotas_marcador (
  id                 INT UNSIGNED AUTO_INCREMENT,
  deporte            ENUM('futbol','baloncesto','beisbol','mma','tenis') NOT NULL,
  etiqueta           VARCHAR(30)  NOT NULL,
  tipo_marcador      ENUM('exacto','rango_margen') NOT NULL DEFAULT 'exacto',
  marcador_local     TINYINT UNSIGNED NOT NULL,
  marcador_visitante TINYINT UNSIGNED NOT NULL,
  multiplicador      DECIMAL(6,2) NOT NULL DEFAULT 1.00,
  activo             TINYINT(1)   NOT NULL DEFAULT 1,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cuotas_marcador_deporte (deporte, marcador_local, marcador_visitante),
  INDEX idx_cuotas_marcador_deporte (deporte),
  INDEX idx_cuotas_marcador_activo  (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PARTE 4: TABLA cuotas_detalle_fin
-- Multiplicadores para el detalle de fin de partido:
-- tiempos extras, penales (fútbol) y métodos de victoria (MMA).
-- ============================================================

CREATE TABLE IF NOT EXISTS cuotas_detalle_fin (
  id            INT UNSIGNED AUTO_INCREMENT,
  deporte       ENUM('futbol','baloncesto','beisbol','mma','tenis') NOT NULL,
  tipo_detalle  ENUM('tiempo_extra','penales','ko','tko','sumision','decision') NOT NULL,
  descripcion   VARCHAR(150) NOT NULL,
  multiplicador DECIMAL(6,2) NOT NULL DEFAULT 1.00,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cuotas_detalle (deporte, tipo_detalle),
  INDEX idx_cuotas_detalle_deporte (deporte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PARTE 5: SEED — cuotas_marcador FÚTBOL
-- Marcador exacto (goles_local - goles_visitante).
-- La columna marcador_local = goles del equipo local.
-- La columna marcador_visitante = goles del equipo visitante.
-- A mayor rareza del marcador → mayor multiplicador.
-- ============================================================

INSERT IGNORE INTO cuotas_marcador
  (deporte, etiqueta, tipo_marcador, marcador_local, marcador_visitante, multiplicador)
VALUES
-- Local gana
('futbol', '1-0', 'exacto', 1, 0,  3.50),
('futbol', '2-0', 'exacto', 2, 0,  5.50),
('futbol', '2-1', 'exacto', 2, 1,  7.00),
('futbol', '3-0', 'exacto', 3, 0,  9.50),
('futbol', '3-1', 'exacto', 3, 1, 12.00),
('futbol', '3-2', 'exacto', 3, 2, 16.00),
('futbol', '4-0', 'exacto', 4, 0, 20.00),
('futbol', '4-1', 'exacto', 4, 1, 25.00),
('futbol', '4-2', 'exacto', 4, 2, 32.00),
('futbol', '5-0', 'exacto', 5, 0, 40.00),

-- Empate
('futbol', '0-0', 'exacto', 0, 0,  6.00),
('futbol', '1-1', 'exacto', 1, 1,  5.00),
('futbol', '2-2', 'exacto', 2, 2,  9.50),
('futbol', '3-3', 'exacto', 3, 3, 22.00),
('futbol', '4-4', 'exacto', 4, 4, 55.00),

-- Visitante gana
('futbol', '0-1', 'exacto', 0, 1,  5.00),
('futbol', '0-2', 'exacto', 0, 2,  8.00),
('futbol', '1-2', 'exacto', 1, 2, 10.00),
('futbol', '0-3', 'exacto', 0, 3, 14.00),
('futbol', '1-3', 'exacto', 1, 3, 18.00),
('futbol', '2-3', 'exacto', 2, 3, 23.00),
('futbol', '0-4', 'exacto', 0, 4, 28.00),
('futbol', '1-4', 'exacto', 1, 4, 36.00),
('futbol', '0-5', 'exacto', 0, 5, 48.00);

-- ============================================================
-- SEED — cuotas_marcador BÉISBOL
-- Marcador exacto por carreras (runs).
-- ============================================================

INSERT IGNORE INTO cuotas_marcador
  (deporte, etiqueta, tipo_marcador, marcador_local, marcador_visitante, multiplicador)
VALUES
-- Local gana
('beisbol', '1-0', 'exacto', 1, 0,  4.00),
('beisbol', '2-0', 'exacto', 2, 0,  5.50),
('beisbol', '2-1', 'exacto', 2, 1,  6.50),
('beisbol', '3-0', 'exacto', 3, 0,  8.00),
('beisbol', '3-1', 'exacto', 3, 1,  9.50),
('beisbol', '3-2', 'exacto', 3, 2, 11.00),
('beisbol', '4-0', 'exacto', 4, 0, 13.00),
('beisbol', '4-1', 'exacto', 4, 1, 15.00),
('beisbol', '4-2', 'exacto', 4, 2, 18.00),
('beisbol', '4-3', 'exacto', 4, 3, 22.00),
('beisbol', '5-0', 'exacto', 5, 0, 20.00),
('beisbol', '5-2', 'exacto', 5, 2, 26.00),
('beisbol', '6-0', 'exacto', 6, 0, 30.00),

-- Visitante gana
('beisbol', '0-1', 'exacto', 0, 1,  5.00),
('beisbol', '0-2', 'exacto', 0, 2,  7.00),
('beisbol', '1-2', 'exacto', 1, 2,  8.50),
('beisbol', '0-3', 'exacto', 0, 3, 10.00),
('beisbol', '1-3', 'exacto', 1, 3, 12.00),
('beisbol', '0-4', 'exacto', 0, 4, 15.00),
('beisbol', '1-4', 'exacto', 1, 4, 18.00),
('beisbol', '0-5', 'exacto', 0, 5, 22.00),
('beisbol', '0-6', 'exacto', 0, 6, 32.00);

-- ============================================================
-- SEED — cuotas_marcador TENIS
-- Sets ganados por cada jugador (formato al mejor de 3 sets).
-- marcador_local     = sets del Jugador 1 (equipo "local")
-- marcador_visitante = sets del Jugador 2 (equipo "visitante")
-- ============================================================

INSERT IGNORE INTO cuotas_marcador
  (deporte, etiqueta, tipo_marcador, marcador_local, marcador_visitante, multiplicador)
VALUES
-- Jugador 1 gana
('tenis', '2-0', 'exacto', 2, 0, 1.80),
('tenis', '2-1', 'exacto', 2, 1, 2.80),
-- Jugador 2 gana
('tenis', '0-2', 'exacto', 0, 2, 2.20),
('tenis', '1-2', 'exacto', 1, 2, 3.50);

-- ============================================================
-- SEED — cuotas_marcador BALONCESTO
-- Rango de diferencia de puntos al final del partido.
-- tipo_marcador = 'rango_margen' (no es marcador exacto).
-- marcador_local     = límite inferior de la diferencia.
-- marcador_visitante = límite superior de la diferencia.
--
-- Ejemplo: si el usuario elige tipo_resultado='local' y
-- selecciona el rango '6-10 pts', significa que su equipo
-- local gana por entre 6 y 10 puntos.
-- ============================================================

INSERT IGNORE INTO cuotas_marcador
  (deporte, etiqueta, tipo_marcador, marcador_local, marcador_visitante, multiplicador)
VALUES
('baloncesto', '1-5 pts',  'rango_margen',  1,  5, 1.80),
('baloncesto', '6-10 pts', 'rango_margen',  6, 10, 2.50),
('baloncesto', '11-15 pts','rango_margen', 11, 15, 3.50),
('baloncesto', '16-20 pts','rango_margen', 16, 20, 5.00),
('baloncesto', '21+ pts',  'rango_margen', 21, 99, 8.00);

-- ============================================================
-- SEED — cuotas_detalle_fin FÚTBOL
-- Solo aplica cuando tipo_resultado = 'empate' y
-- el evento es tipo_fase = 'eliminatoria'.
-- ============================================================

INSERT IGNORE INTO cuotas_detalle_fin
  (deporte, tipo_detalle, descripcion, multiplicador)
VALUES
(
  'futbol', 'tiempo_extra',
  'El partido empata en tiempo reglamentario y se juega tiempo extra (30 min). Uno de los equipos gana en la prórroga.',
  1.80
),
(
  'futbol', 'penales',
  'El partido empata incluso en tiempo extra y se define por tanda de penales.',
  2.50
);

-- ============================================================
-- SEED — cuotas_detalle_fin MMA
-- Aplica cuando tipo_resultado = 'local' o 'visitante'.
-- Indica el método con el que el peleador elegido ganará.
-- ============================================================

INSERT IGNORE INTO cuotas_detalle_fin
  (deporte, tipo_detalle, descripcion, multiplicador)
VALUES
(
  'mma', 'ko',
  'El peleador gana por Knockout (KO): el rival pierde el conocimiento.',
  2.20
),
(
  'mma', 'tko',
  'El peleador gana por Knockout Técnico (TKO): el árbitro detiene el combate por incapacidad del rival.',
  1.90
),
(
  'mma', 'sumision',
  'El peleador gana por sumisión: el rival abandona debido a una llave, estrangulación u otra técnica.',
  2.50
),
(
  'mma', 'decision',
  'El combate llega a los rounds completos y los jueces deciden al ganador por puntos.',
  1.60
);

-- ============================================================
-- REGISTRO EN TABLA DE CONTROL
-- ============================================================

INSERT IGNORE INTO schema_migrations (version)
VALUES ('005_resultado_exacto');