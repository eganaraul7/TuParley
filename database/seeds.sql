-- ============================================================
-- TuParley: Seeds iniciales
-- Archivo: database/seeds.sql
-- IMPORTANTE: Ejecutar DESPUÉS de schema.sql
-- ============================================================
-- Contraseña por defecto computadora_madre: Admin@TuParley2024!
-- CAMBIA ESTA CONTRASEÑA INMEDIATAMENTE TRAS EL PRIMER LOGIN
-- ============================================================

USE tuparley;

SET NAMES utf8mb4;
SET time_zone = '-04:00';
SET foreign_key_checks = 0;

-- ============================================================
-- 1. BODEGA CENTRAL (inicial)
-- ============================================================
INSERT INTO bodegas (id, nombre, ubicacion, prefijo, activa) VALUES
(1, 'Bodega Central', 'Caracas, Venezuela', 'B1', 1);

-- ============================================================
-- 2. COMPUTADORA MADRE
-- Hash de: Admin@TuParley2024!  (bcrypt cost 12)
-- ============================================================
INSERT INTO usuarios (
  id, nombre_usuario, contrasena_hash, rol,
  bodega_id, bloqueado, intentos_fallidos,
  sesion_activa, totp_habilitado
) VALUES (
  1,
  'computadora_madre',
  '$2b$12$Ux.cYl25pkaggm3eNh.Sduv4Q5/XkBUeeQaz5qdppeZtZOYaWhuCO',
  'computadora_madre',
  NULL, 0, 0, 0, 0
);

-- ============================================================
-- 3. CONFIGURACION DEL SISTEMA
-- ============================================================
INSERT INTO configuracion_sistema (clave, valor, descripcion, actualizado_por) VALUES
('max_ganancia_usd',       '300',   'Ganancia máxima por ticket en USD',                  1),
('apuesta_minima_usd',     '1',     'Apuesta mínima en USD',                              1),
('modo_mantenimiento',     '0',     '1=sistema en mantenimiento, 0=operativo',            1),
('bcv_rango_minimo',       '30',    'Tasa BCV mínima válida (Bs/$)',                      1),
('bcv_rango_maximo',       '200',   'Tasa BCV máxima válida (Bs/$)',                      1),
('horario_apertura',       '05:00', 'Hora de apertura de sesión bodeguero (VET)',         1),
('horario_cierre',         '19:00', 'Hora máxima de cierre de caja (VET)',                1),
('horas_vencimiento_premio','48',   'Horas para cobrar premio antes de CADUCADO_GANADOR', 1),
('porcentaje_bodeguero',   '20',    'Porcentaje de ganancias para el bodeguero',          1),
('porcentaje_operador',    '80',    'Porcentaje de ganancias para el operador',           1),
('max_intentos_login',     '5',     'Intentos fallidos antes de bloquear usuario',        1);

-- ============================================================
-- 4. CATEGORIAS CONFIG (todas activas por defecto)
-- ============================================================
INSERT INTO categorias_config (deporte, activa, actualizado_por) VALUES
('futbol',      1, 1),
('baloncesto',  1, 1),
('beisbol',     1, 1),
('caballos',    1, 1),
('tenis',       1, 1);

-- ============================================================
-- 5. TASA BCV INICIAL (placeholder — se actualiza vía API)
-- ============================================================
INSERT INTO tasa_bcv (valor, fuente, validada, actualizado_por, fecha) VALUES
(45.20, 'manual', 1, 1, CURDATE());

-- ============================================================
-- 6. MODALIDADES — FÚTBOL (5)
-- ============================================================
INSERT INTO modalidades (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa) VALUES
(
  'futbol',
  'Doble Oportunidad',
  'Apuesta a dos de los tres resultados posibles: 1X (Local o Empate), X2 (Empate o Visitante) o 12 (Local o Visitante). Es la modalidad más segura del fútbol.',
  1.30, 1.50, 1.40,
  'facil', 1
),
(
  'futbol',
  'Over/Under Goles',
  'Predice si el total de goles marcados en el partido será MÁS (Over) o MENOS (Under) de un número determinado, generalmente 2.5 goles.',
  1.50, 1.80, 1.65,
  'facil_media', 1
),
(
  'futbol',
  'Gol en el Primer Tiempo',
  'Apuesta a si alguno de los dos equipos marcará al menos un gol durante los primeros 45 minutos del partido.',
  1.80, 2.20, 2.00,
  'media', 1
),
(
  'futbol',
  'Ganador Directo (1X2)',
  'Predice el resultado final del partido: 1 (Gana el equipo local), X (Empate) o 2 (Gana el equipo visitante). Es la apuesta clásica del fútbol.',
  1.80, 2.50, 2.10,
  'media', 1
),
(
  'futbol',
  'Marcador Exacto',
  'Predice el marcador exacto al final del partido. Por ejemplo: 1-0, 2-1, 0-0. Es la modalidad más difícil y con mayor premio del fútbol.',
  3.00, 8.00, 5.00,
  'dificil', 1
);

-- ============================================================
-- 7. MODALIDADES — BALONCESTO (5)
-- ============================================================
INSERT INTO modalidades (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa) VALUES
(
  'baloncesto',
  'Ganador del Partido',
  'Predice qué equipo ganará el partido de baloncesto. Solo hay dos opciones: equipo local o equipo visitante. No hay empate en baloncesto.',
  1.40, 1.70, 1.55,
  'facil', 1
),
(
  'baloncesto',
  'Over/Under Puntos',
  'Apuesta a si el total de puntos anotados por AMBOS equipos combinados será MÁS (Over) o MENOS (Under) de un número establecido, ej: 210.5 puntos.',
  1.50, 1.80, 1.65,
  'facil_media', 1
),
(
  'baloncesto',
  'Handicap de Puntos',
  'A un equipo se le da una ventaja o desventaja de puntos para igualar las posibilidades. Ej: si el Local tiene -5.5, necesita ganar por 6 o más puntos.',
  1.70, 2.20, 1.95,
  'media', 1
),
(
  'baloncesto',
  'Ganador del Primer Cuarto',
  'Predice qué equipo tendrá más puntos al finalizar el primer cuarto del partido (primeros 12 minutos de juego).',
  2.00, 2.80, 2.40,
  'media_dificil', 1
),
(
  'baloncesto',
  'Diferencia de Puntos',
  'Apuesta a un rango exacto de diferencia de puntos al final del partido. Por ejemplo: el equipo local gana por entre 10 y 15 puntos.',
  2.50, 4.00, 3.25,
  'dificil', 1
);

-- ============================================================
-- 8. MODALIDADES — BÉISBOL (5)
-- ============================================================
INSERT INTO modalidades (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa) VALUES
(
  'beisbol',
  'Ganador del Partido (Moneyline)',
  'Elige qué equipo ganará el partido de béisbol completo (incluyendo entradas extra si es necesario). La modalidad más simple del béisbol.',
  1.40, 1.70, 1.55,
  'facil', 1
),
(
  'beisbol',
  'Over/Under Carreras',
  'Predice si el total de carreras anotadas por ambos equipos será MÁS (Over) o MENOS (Under) de un número determinado, generalmente 8.5 carreras.',
  1.50, 1.80, 1.65,
  'facil_media', 1
),
(
  'beisbol',
  'Run Line (Handicap)',
  'Similar al handicap: el equipo favorito necesita ganar por 2 o más carreras (-1.5) o el equipo débil puede perder por solo 1 carrera (+1.5).',
  1.70, 2.20, 1.95,
  'media', 1
),
(
  'beisbol',
  'Ganador de la Primera Entrada',
  'Predice qué equipo anotará más carreras exclusivamente en la primera entrada del partido. Si no hay carreras, es empate y se anula.',
  2.20, 3.00, 2.60,
  'media_dificil', 1
),
(
  'beisbol',
  'Total de Hits del Partido',
  'Apuesta al número total de hits (golpes conectados) que habrá en todo el partido entre ambos equipos combinados. Over o Under de un número fijo.',
  2.50, 4.00, 3.25,
  'dificil', 1
);

-- ============================================================
-- 9. MODALIDADES — CARRERAS DE CABALLOS (5)
-- ============================================================
INSERT INTO modalidades (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa) VALUES
(
  'caballos',
  'Ganador (Win)',
  'Apuesta simple: elige qué caballo llegará en PRIMER lugar al cruzar la meta. Es la apuesta más básica y frecuente en carreras.',
  2.00, 4.00, 3.00,
  'facil', 1
),
(
  'caballos',
  'Doble Perfecta',
  'Predice los caballos que quedarán en PRIMER y SEGUNDO lugar, en cualquier orden. Más difícil que el ganador simple, con mayor premio.',
  4.00, 8.00, 6.00,
  'media', 1
),
(
  'caballos',
  'Perfecta (Exacta)',
  'Predice los caballos que quedarán en PRIMER y SEGUNDO lugar, EN ESE ORDEN EXACTO. Si se equivoca el orden, pierde la apuesta.',
  6.00, 12.00, 9.00,
  'media_dificil', 1
),
(
  'caballos',
  'Triple Perfecta (Trifecta)',
  'Predice los tres primeros caballos EN EL ORDEN EXACTO de llegada (1°, 2° y 3°). Alta dificultad con premios muy elevados.',
  15.00, 40.00, 27.50,
  'dificil', 1
),
(
  'caballos',
  'Superfecta',
  'Predice los CUATRO primeros caballos EN EL ORDEN EXACTO de llegada. La apuesta más difícil y con el mayor premio posible en carreras.',
  40.00, 100.00, 70.00,
  'muy_dificil', 1
);

-- ============================================================
-- 10. MODALIDADES — TENIS (5)
-- ============================================================
INSERT INTO modalidades (deporte, nombre, descripcion, cuota_minima, cuota_maxima, cuota_base, dificultad, activa) VALUES
(
  'tenis',
  'Ganador del Partido',
  'Selecciona qué jugador ganará el partido completo. Solo dos opciones posibles. La apuesta más directa del tenis.',
  1.40, 1.70, 1.55,
  'facil', 1
),
(
  'tenis',
  'Ganador del Primer Set',
  'Predice qué jugador ganará el PRIMER set del partido, independientemente del resultado final del encuentro.',
  1.60, 2.00, 1.80,
  'facil_media', 1
),
(
  'tenis',
  'Over/Under Juegos',
  'Apuesta a si el número total de juegos disputados en todo el partido será MÁS (Over) o MENOS (Under) de un número fijo, ej: 22.5 juegos.',
  1.70, 2.20, 1.95,
  'media', 1
),
(
  'tenis',
  'Número de Sets',
  'Predice en cuántos sets terminará el partido: 2 sets (para partidos al mejor de 3) o 3 sets. Depende del formato del torneo.',
  1.80, 2.50, 2.15,
  'media', 1
),
(
  'tenis',
  'Set Exacto',
  'Predice el marcador exacto en sets del partido. Ejemplo: 2-0, 2-1 para formato al mejor de 3 sets. Alta dificultad con buen premio.',
  2.50, 5.00, 3.75,
  'dificil', 1
);

SET foreign_key_checks = 1;

INSERT IGNORE INTO schema_migrations (version) VALUES ('002_seeds');