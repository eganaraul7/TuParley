-- ============================================================
-- TuParley: Migration 006 — Modalidades de Resultado Directo
-- Archivo: database/migrations/006_modalidades_tres_botones.sql
-- Descripción:
--   1. Agrega columna tipo_resultado_btn a modalidades
--      para identificar cuál de los 3 botones representa
--      cada modalidad (local | empate | visitante).
--   2. Inserta las modalidades de resultado directo por deporte:
--        Fútbol     → 3 botones: Local ×1.40 · Empate ×3.20 · Visitante ×1.40
--        Baloncesto → 2 botones: Local ×1.40 · Visitante ×1.40
--        Béisbol    → 2 botones: Local ×1.40 · Visitante ×1.40
--        Tenis      → 2 botones: Jugador 1 ×1.40 · Jugador 2 ×1.40
--        MMA        → 2 botones: Peleador 1 ×1.40 · Peleador 2 ×1.40
-- ============================================================

USE tuparley;

-- ============================================================
-- PARTE 1: AGREGAR COLUMNA tipo_resultado_btn
-- NULL = modalidad antigua (over/under, hándicap, etc.)
-- 'local'     = botón izquierdo  (equipo/jugador local)
-- 'empate'    = botón central    (empate / tiempo extra)
-- 'visitante' = botón derecho    (equipo/jugador visitante)
-- ============================================================

ALTER TABLE modalidades
  ADD COLUMN tipo_resultado_btn
    ENUM('local', 'empate', 'visitante')
    NULL
    DEFAULT NULL
  AFTER activa;

-- Índice para que el frontend encuentre rápido los 3 botones por deporte
CREATE INDEX idx_modalidades_btn
  ON modalidades (deporte, tipo_resultado_btn);

-- ============================================================
-- PARTE 2: FÚTBOL — 3 botones
-- Local ×1.40 | Empate ×3.20 | Visitante ×1.40
-- ============================================================

INSERT IGNORE INTO modalidades
  (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa, tipo_resultado_btn)
VALUES
(
  'futbol', 'Gana Local',
  'El equipo local gana al final del tiempo reglamentario.',
  1.40, 1.40, 1.40, 'facil', 1, 'local'
),
(
  'futbol', 'Empate',
  'El partido termina en empate al final del tiempo reglamentario (90 min). En fases eliminatorias puede continuar en tiempo extra o penales: puedes indicarlo de forma opcional para aumentar tu cuota.',
  3.20, 3.20, 3.20, 'media', 1, 'empate'
),
(
  'futbol', 'Gana Visitante',
  'El equipo visitante gana al final del tiempo reglamentario.',
  1.40, 1.40, 1.40, 'facil', 1, 'visitante'
);

-- ============================================================
-- PARTE 3: BALONCESTO — 2 botones (sin empate)
-- ============================================================

INSERT IGNORE INTO modalidades
  (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa, tipo_resultado_btn)
VALUES
(
  'baloncesto', 'Gana Local',
  'El equipo local gana el partido. No hay empate en baloncesto.',
  1.40, 1.40, 1.40, 'facil', 1, 'local'
),
(
  'baloncesto', 'Gana Visitante',
  'El equipo visitante gana el partido. No hay empate en baloncesto.',
  1.40, 1.40, 1.40, 'facil', 1, 'visitante'
);

-- ============================================================
-- PARTE 4: BÉISBOL — 2 botones (sin empate)
-- ============================================================

INSERT IGNORE INTO modalidades
  (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa, tipo_resultado_btn)
VALUES
(
  'beisbol', 'Gana Local',
  'El equipo local gana el partido. En caso de empate se juegan innings extra.',
  1.40, 1.40, 1.40, 'facil', 1, 'local'
),
(
  'beisbol', 'Gana Visitante',
  'El equipo visitante gana el partido. En caso de empate se juegan innings extra.',
  1.40, 1.40, 1.40, 'facil', 1, 'visitante'
);

-- ============================================================
-- PARTE 5: TENIS — 2 botones (sin empate)
-- ============================================================

INSERT IGNORE INTO modalidades
  (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa, tipo_resultado_btn)
VALUES
(
  'tenis', 'Gana Jugador 1',
  'El primer jugador (local) gana el partido. Puedes indicar el resultado en sets de forma opcional para aumentar tu cuota.',
  1.40, 1.40, 1.40, 'facil', 1, 'local'
),
(
  'tenis', 'Gana Jugador 2',
  'El segundo jugador (visitante) gana el partido. Puedes indicar el resultado en sets de forma opcional para aumentar tu cuota.',
  1.40, 1.40, 1.40, 'facil', 1, 'visitante'
);

-- ============================================================
-- PARTE 6: MMA — 2 botones
-- El método de victoria (KO, TKO, sumisión, decisión)
-- se elige de forma opcional en el PanelMarcador.
-- ============================================================

INSERT IGNORE INTO modalidades
  (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa, tipo_resultado_btn)
VALUES
(
  'mma', 'Gana Peleador 1',
  'El primer peleador (local) gana el combate por cualquier método. Puedes indicar KO, TKO, sumisión o decisión de forma opcional para aumentar tu cuota.',
  1.40, 1.40, 1.40, 'facil', 1, 'local'
),
(
  'mma', 'Gana Peleador 2',
  'El segundo peleador (visitante) gana el combate por cualquier método. Puedes indicar KO, TKO, sumisión o decisión de forma opcional para aumentar tu cuota.',
  1.40, 1.40, 1.40, 'facil', 1, 'visitante'
);

-- ============================================================
-- REGISTRO EN TABLA DE CONTROL
-- ============================================================

INSERT IGNORE INTO schema_migrations (version)
VALUES ('006_modalidades_tres_botones');