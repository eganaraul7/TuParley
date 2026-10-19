// Nombre de archivo: evento.controller.js
// Ruta: backend/src/controllers/evento.controller.js
// Función: Controlador de eventos deportivos — CRUD, activación, filtros y marcadores en vivo

'use strict';

const { query } = require('../config/db');
const { liquidarEvento, suspenderEvento } = require('../services/liquidacion.service');

// ─── helpers ─────────────────────────────────────────────────────────────────

async function _log(usuarioId, accion, entidad_afectada, entidad_id, detalle, ip) {
  await query(
    `INSERT INTO auditoria_logs (usuario_id, accion, entidad_afectada, entidad_id, detalle, ip_address)
      VALUES (?,?,?,?,?,?)`,
    [usuarioId ?? null, accion, entidad_afectada ?? null, entidad_id ?? null,
      detalle ? JSON.stringify(detalle) : null, ip ?? null]
  );
}

function _ip(req) {
  return req.ip || '';
}

const DEPORTES_VALIDOS = ['futbol', 'baloncesto', 'beisbol', 'mma', 'tenis'];

// ─── GET /api/eventos ─────────────────────────────────────────────────────────

async function listarEventos(req, res) {
  const { deporte, liga, equipo, fecha, estado } = req.query;

  try {
    // Ventana calculada por MySQL (sesión en -04:00) para no mezclar UTC con VET.
    // Sin filtro de estado (vista del bodeguero) solo se listan eventos aún no iniciados.
    let sql = `
      SELECT e.id, e.api_evento_id, e.deporte, e.liga,
             e.equipo_local, e.equipo_visitante, e.fecha_inicio,
             e.estado, e.activo, e.tipo_fase,
             cc.activa  AS categoria_activa,
             COALESCE(tc.activo, 1) AS torneo_activo
        FROM eventos e
        JOIN categorias_config cc ON cc.deporte = e.deporte
        LEFT JOIN torneos_config tc
               ON tc.deporte = e.deporte AND tc.nombre_liga = e.liga
       WHERE e.fecha_inicio <= NOW() + INTERVAL 7 DAY
         AND e.fecha_inicio ${estado ? '>= NOW() - INTERVAL 2 DAY' : '> NOW()'}`;
    const params = [];

    if (deporte) { sql += ' AND e.deporte = ?';                                              params.push(deporte); }
    if (liga)    { sql += ' AND e.liga LIKE ?';                                              params.push(`%${liga}%`); }
    if (equipo)  { sql += ' AND (e.equipo_local LIKE ? OR e.equipo_visitante LIKE ?)';       params.push(`%${equipo}%`, `%${equipo}%`); }
    if (fecha)   { sql += ' AND DATE(e.fecha_inicio) = ?';                                   params.push(fecha); }
    if (estado)  { sql += ' AND e.estado = ?';                                               params.push(estado); }
    else {
      sql += ` AND e.estado = 'programado'
               AND e.activo = 1
               AND cc.activa = 1
               AND COALESCE(tc.activo, 1) = 1`;
    }

    sql += ' ORDER BY e.fecha_inicio ASC';

    const eventos = await query(sql, params);
    return res.status(200).json({ eventos });
  } catch (err) {
    console.error('[evento.controller] listarEventos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/eventos/:id ─────────────────────────────────────────────────────

async function obtenerEvento(req, res) {
  const { id } = req.params;
  try {
    const rows = await query(
      `SELECT e.*, cc.activa AS categoria_activa
          FROM eventos e
          JOIN categorias_config cc ON cc.deporte = e.deporte
        WHERE e.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });

    const modalidades = await query(
      `SELECT id, nombre, descripcion, cuota_base, cuota_minima, cuota_maxima, dificultad, activa
         FROM modalidades
        WHERE deporte = ? AND activa = 1
        ORDER BY dificultad`,
      [rows[0].deporte]
    );

    return res.status(200).json({ evento: rows[0], modalidades });
  } catch (err) {
    console.error('[evento.controller] obtenerEvento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/eventos ────────────────────────────────────────────────────────

async function crearEvento(req, res) {
  const { deporte, liga, equipo_local, equipo_visitante, fecha_inicio, api_evento_id,
          tipo_fase = 'amistoso' } = req.body;
  const ip = _ip(req);

  if (!deporte || !liga || !equipo_local || !equipo_visitante || !fecha_inicio) {
    return res.status(400).json({ error: 'deporte, liga, equipo_local, equipo_visitante y fecha_inicio son requeridos' });
  }
  if (!DEPORTES_VALIDOS.includes(deporte)) {
    return res.status(400).json({ error: `deporte inválido. Válidos: ${DEPORTES_VALIDOS.join(', ')}` });
  }
  const FASES_VALIDAS = ['amistoso', 'fase_grupos', 'eliminatoria'];
  if (!FASES_VALIDAS.includes(tipo_fase)) {
    return res.status(400).json({ error: `tipo_fase inválido. Válidos: ${FASES_VALIDAS.join(', ')}` });
  }

  try {
    const result = await query(
      `INSERT INTO eventos (api_evento_id, deporte, liga, equipo_local, equipo_visitante, fecha_inicio, tipo_fase, estado, activo)
       VALUES (?,?,?,?,?,?,?,'programado',1)`,
      [api_evento_id ?? null, deporte, liga, equipo_local, equipo_visitante, fecha_inicio, tipo_fase]
    );

    await query(
      `INSERT IGNORE INTO torneos_config (deporte, nombre_liga, activo) VALUES (?, ?, 1)`,
      [deporte, liga]
    );

    await _log(req.usuario.id, 'crear_evento', 'eventos', result.insertId,
      { deporte, liga, equipo_local, equipo_visitante }, ip);

    return res.status(201).json({ mensaje: 'Evento creado', evento_id: result.insertId });
  } catch (err) {
    console.error('[evento.controller] crearEvento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PUT /api/eventos/:id ─────────────────────────────────────────────────────

async function actualizarEvento(req, res) {
  const { id } = req.params;
  const { liga, equipo_local, equipo_visitante, fecha_inicio, estado,
          resultado_final, tipo_fase } = req.body;
  const ip = _ip(req);

  try {
    const rows = await query(`SELECT id, deporte FROM eventos WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });

    const campos = []; const params = [];
    if (liga)             { campos.push('liga = ?');             params.push(liga); }
    if (equipo_local)     { campos.push('equipo_local = ?');     params.push(equipo_local); }
    if (equipo_visitante) { campos.push('equipo_visitante = ?'); params.push(equipo_visitante); }
    if (fecha_inicio)     { campos.push('fecha_inicio = ?');     params.push(fecha_inicio); }
    if (resultado_final)  { campos.push('resultado_final = ?');  params.push(resultado_final); }
    if (tipo_fase) {
      const fasesValidas = ['amistoso', 'fase_grupos', 'eliminatoria'];
      if (!fasesValidas.includes(tipo_fase)) {
        return res.status(400).json({ error: `tipo_fase inválido. Válidos: ${fasesValidas.join(', ')}` });
      }
      campos.push('tipo_fase = ?'); params.push(tipo_fase);
    }
    if (estado) {
      const estadosValidos = ['programado', 'en_curso', 'finalizado', 'suspendido', 'cancelado'];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: `estado inválido. Válidos: ${estadosValidos.join(', ')}` });
      }
      campos.push('estado = ?'); params.push(estado);
    }

    if (campos.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(id);
    await query(`UPDATE eventos SET ${campos.join(', ')}, updated_at = NOW() WHERE id = ?`, params);

    // Suspender/cancelar deja los tickets pendientes en SUSPENDIDO (devolución a pedido);
    // finalizar dispara la liquidación con el resultado guardado.
    let liquidacion = null;
    if (estado === 'suspendido' || estado === 'cancelado') await suspenderEvento(Number(id), estado);
    if (estado === 'finalizado') liquidacion = await liquidarEvento(Number(id));

    if (liga) {
      await query(
        `INSERT IGNORE INTO torneos_config (deporte, nombre_liga, activo) VALUES (?, ?, 1)`,
        [rows[0].deporte, liga]
      );
    }

    await _log(req.usuario.id, 'actualizar_evento', 'eventos', Number(id), req.body, ip);

    return res.status(200).json({ mensaje: 'Evento actualizado', liquidacion });
  } catch (err) {
    console.error('[evento.controller] actualizarEvento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/eventos/:id/toggle ────────────────────────────────────────────

async function toggleEvento(req, res) {
  const { id } = req.params;
  const ip = _ip(req);
  try {
    const rows = await query(`SELECT id, activo, estado FROM eventos WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });

    const nuevoActivo = rows[0].activo ? 0 : 1;
    await query(`UPDATE eventos SET activo = ?, updated_at = NOW() WHERE id = ?`, [nuevoActivo, id]);
    await _log(req.usuario.id, nuevoActivo ? 'activar_evento' : 'desactivar_evento',
      'eventos', Number(id), null, ip);

    return res.status(200).json({ mensaje: `Evento ${nuevoActivo ? 'activado' : 'desactivado'}`, activo: nuevoActivo });
  } catch (err) {
    console.error('[evento.controller] toggleEvento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/eventos/torneos/lista ──────────────────────────────────────────

async function listarTorneos(req, res) {
  const { deporte } = req.query;
  try {
    let sql = `
      SELECT tc.id, tc.deporte, tc.nombre_liga, tc.activo,
             tc.created_at, tc.updated_at,
             u.nombre_usuario AS actualizado_por_nombre,
             COUNT(e.id)      AS eventos_disponibles
        FROM torneos_config tc
        LEFT JOIN usuarios u ON u.id = tc.actualizado_por
        LEFT JOIN eventos e
               ON e.deporte = tc.deporte
              AND e.liga     = tc.nombre_liga
              AND e.estado   = 'programado'
              AND e.activo   = 1
              AND e.fecha_inicio >= NOW()
       WHERE 1=1`;
    const params = [];
    if (deporte) { sql += ' AND tc.deporte = ?'; params.push(deporte); }
    sql += ' GROUP BY tc.id, tc.deporte, tc.nombre_liga, tc.activo, tc.created_at, tc.updated_at, u.nombre_usuario';
    sql += ' ORDER BY tc.deporte ASC, tc.nombre_liga ASC';

    const torneos = await query(sql, params);
    return res.status(200).json({ torneos });
  } catch (err) {
    console.error('[evento.controller] listarTorneos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/eventos/torneos/:id/toggle ────────────────────────────────────

async function toggleTorneo(req, res) {
  const { id } = req.params;
  const ip = _ip(req);
  try {
    const rows = await query(
      `SELECT id, activo, deporte, nombre_liga FROM torneos_config WHERE id = ? LIMIT 1`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Torneo no encontrado' });

    const nuevoActivo = rows[0].activo ? 0 : 1;
    await query(
      `UPDATE torneos_config SET activo = ?, actualizado_por = ?, updated_at = NOW() WHERE id = ?`,
      [nuevoActivo, req.usuario.id, id]
    );
    await _log(
      req.usuario.id,
      nuevoActivo ? 'activar_torneo' : 'desactivar_torneo',
      'torneos_config',
      Number(id),
      { deporte: rows[0].deporte, liga: rows[0].nombre_liga },
      ip
    );

    return res.status(200).json({
      mensaje: `Torneo ${nuevoActivo ? 'activado' : 'desactivado'}`,
      activo:  nuevoActivo,
    });
  } catch (err) {
    console.error('[evento.controller] toggleTorneo:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/categorias ──────────────────────────────────────────────────────

async function listarCategorias(req, res) {
  try {
    const categorias = await query(
      `SELECT cc.deporte, cc.activa, cc.updated_at,
              u.nombre_usuario AS actualizado_por_nombre,
              COUNT(e.id) AS eventos_disponibles
         FROM categorias_config cc
         LEFT JOIN usuarios u ON u.id = cc.actualizado_por
         LEFT JOIN eventos e ON e.deporte = cc.deporte
                             AND e.estado = 'programado'
                             AND e.activo = 1
                             AND e.fecha_inicio >= NOW()
        GROUP BY cc.deporte, cc.activa, cc.updated_at, u.nombre_usuario`
    );
    return res.status(200).json({ categorias });
  } catch (err) {
    console.error('[evento.controller] listarCategorias:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/categorias/:deporte/toggle ────────────────────────────────────

async function toggleCategoria(req, res) {
  const { deporte } = req.params;
  const ip = _ip(req);

  if (!DEPORTES_VALIDOS.includes(deporte)) {
    return res.status(400).json({ error: `deporte inválido. Válidos: ${DEPORTES_VALIDOS.join(', ')}` });
  }

  try {
    const rows = await query(`SELECT activa FROM categorias_config WHERE deporte = ? LIMIT 1`, [deporte]);
    if (rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });

    const nuevaActiva = rows[0].activa ? 0 : 1;
    await query(
      `UPDATE categorias_config SET activa = ?, actualizado_por = ?, updated_at = NOW() WHERE deporte = ?`,
      [nuevaActiva, req.usuario.id, deporte]
    );
    await _log(req.usuario.id, nuevaActiva ? 'activar_categoria' : 'desactivar_categoria',
      'categorias_config', null, { deporte }, ip);

    return res.status(200).json({ mensaje: `Categoría ${deporte} ${nuevaActiva ? 'activada' : 'desactivada'}`, activa: nuevaActiva });
  } catch (err) {
    console.error('[evento.controller] toggleCategoria:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/modalidades ─────────────────────────────────────────────────────

async function listarModalidades(req, res) {
  const { deporte, activa } = req.query;
  try {
    let sql = `SELECT id, deporte, nombre, descripcion, cuota_base, cuota_minima,
                      cuota_maxima, dificultad, activa, tipo_resultado_btn FROM modalidades WHERE 1=1`;
    const params = [];
    if (deporte) { sql += ' AND deporte = ?'; params.push(deporte); }
    if (activa !== undefined) { sql += ' AND activa = ?'; params.push(activa === 'true' ? 1 : 0); }
    sql += ' ORDER BY deporte, dificultad';

    const modalidades = await query(sql, params);
    return res.status(200).json({ modalidades });
  } catch (err) {
    console.error('[evento.controller] listarModalidades:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/modalidades/:id/toggle ───────────────────────────────────────

async function toggleModalidad(req, res) {
  const { id } = req.params;
  const ip = _ip(req);
  try {
    const rows = await query(`SELECT id, activa, nombre FROM modalidades WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Modalidad no encontrada' });

    const nuevaActiva = rows[0].activa ? 0 : 1;
    await query(`UPDATE modalidades SET activa = ?, updated_at = NOW() WHERE id = ?`, [nuevaActiva, id]);
    await _log(req.usuario.id, nuevaActiva ? 'activar_modalidad' : 'desactivar_modalidad',
      'modalidades', Number(id), { nombre: rows[0].nombre }, ip);

    return res.status(200).json({ mensaje: `Modalidad ${nuevaActiva ? 'activada' : 'desactivada'}`, activa: nuevaActiva });
  } catch (err) {
    console.error('[evento.controller] toggleModalidad:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/modalidades/:id/cuota ────────────────────────────────────────

async function actualizarCuotaModalidad(req, res) {
  const { id } = req.params;
  const { cuota_base, cuota_minima, cuota_maxima } = req.body;
  const ip = _ip(req);

  if (!cuota_base) return res.status(400).json({ error: 'cuota_base es requerida' });
  if (parseFloat(cuota_base) < 1) return res.status(400).json({ error: 'cuota_base debe ser >= 1' });

  try {
    const rows = await query(`SELECT id, nombre FROM modalidades WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Modalidad no encontrada' });

    const campos = ['cuota_base = ?']; const params = [cuota_base];
    if (cuota_minima) { campos.push('cuota_minima = ?'); params.push(cuota_minima); }
    if (cuota_maxima) { campos.push('cuota_maxima = ?'); params.push(cuota_maxima); }
    params.push(id);

    await query(`UPDATE modalidades SET ${campos.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    await _log(req.usuario.id, 'actualizar_cuota_modalidad', 'modalidades', Number(id),
      { nombre: rows[0].nombre, cuota_base, cuota_minima, cuota_maxima }, ip);

    return res.status(200).json({ mensaje: 'Cuota actualizada' });
  } catch (err) {
    console.error('[evento.controller] actualizarCuotaModalidad:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/eventos/marcadores-en-vivo ─────────────────────────────────────

async function marcadoresEnVivo(req, res) {
  try {
    const eventos = await query(
      `SELECT id, deporte, liga, equipo_local, equipo_visitante,
              fecha_inicio, estado, resultado_final
          FROM eventos
        WHERE estado = 'en_curso'
        ORDER BY fecha_inicio ASC`
    );
    return res.status(200).json({ eventos });
  } catch (err) {
    console.error('[evento.controller] marcadoresEnVivo:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/eventos/cuotas-marcador/lista ───────────────────────────────────
// Devuelve los multiplicadores de marcador exacto por deporte.
// El frontend los usa para mostrar las opciones de marcador opcional.
// Query param ?deporte=futbol para filtrar por deporte.

async function listarCuotasMarcador(req, res) {
  const { deporte } = req.query;
  try {
    let sql = `SELECT id, deporte, etiqueta, tipo_marcador,
                      marcador_local, marcador_visitante, multiplicador
                 FROM cuotas_marcador
                WHERE activo = 1`;
    const params = [];
    if (deporte) { sql += ' AND deporte = ?'; params.push(deporte); }
    sql += ' ORDER BY deporte, marcador_local ASC, marcador_visitante ASC';

    const cuotas = await query(sql, params);
    return res.status(200).json({ cuotas });
  } catch (err) {
    console.error('[evento.controller] listarCuotasMarcador:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/eventos/cuotas-detalle/lista ────────────────────────────────────
// Devuelve los multiplicadores de detalle de fin por deporte.
// El frontend los usa para mostrar opciones de tiempo extra / penales / método MMA.
// Query param ?deporte=futbol para filtrar por deporte.

async function listarCuotasDetalle(req, res) {
  const { deporte } = req.query;
  try {
    let sql = `SELECT id, deporte, tipo_detalle, descripcion, multiplicador
                 FROM cuotas_detalle_fin
                WHERE activo = 1`;
    const params = [];
    if (deporte) { sql += ' AND deporte = ?'; params.push(deporte); }
    sql += ' ORDER BY deporte, tipo_detalle';

    const cuotas = await query(sql, params);
    return res.status(200).json({ cuotas });
  } catch (err) {
    console.error('[evento.controller] listarCuotasDetalle:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/eventos/resultados/pendientes ──────────────────────────────────
// Eventos que necesitan resultado: en curso que ya deberían haber terminado
// o finalizados con selecciones que no se pudieron liquidar automáticamente.

async function listarPendientesResultado(req, res) {
  try {
    const eventos = await query(
      `SELECT e.id, e.deporte, e.liga, e.equipo_local, e.equipo_visitante, e.fecha_inicio,
              e.estado, e.tipo_fase, e.resultado_final, e.ganador_final, e.detalle_fin_final,
              (SELECT COUNT(*) FROM selecciones_ticket st JOIN tickets t ON t.id = st.ticket_id
                WHERE st.evento_id = e.id AND st.resultado = 'pendiente' AND t.estado = 'PENDIENTE') AS selecciones_pendientes
         FROM eventos e
        WHERE (e.estado = 'en_curso' AND e.fecha_inicio <= NOW() - INTERVAL 90 MINUTE)
           OR (e.estado = 'finalizado' AND EXISTS (
                 SELECT 1 FROM selecciones_ticket st JOIN tickets t ON t.id = st.ticket_id
                  WHERE st.evento_id = e.id AND st.resultado = 'pendiente' AND t.estado = 'PENDIENTE'))
        ORDER BY e.fecha_inicio ASC
        LIMIT 200`
    );
    return res.status(200).json({ eventos });
  } catch (err) {
    console.error('[evento.controller] listarPendientesResultado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/eventos/:id/resultado ────────────────────────────────────────
// Registro manual del resultado (tenis, MMA, o cuando la API no lo trae).
// Body: { marcador_local?, marcador_visitante?, ganador?, detalle_fin? }
//   fútbol: marcador al final del tiempo reglamentario; detalle_fin tiempo_extra|penales si aplica
//   tenis: sets ganados por cada jugador · MMA: ganador y método (ko|tko|sumision|decision)

const GANADORES = ['local', 'empate', 'visitante'];
const DETALLES  = { futbol: ['tiempo_extra', 'penales'], mma: ['ko', 'tko', 'sumision', 'decision'] };

async function registrarResultado(req, res) {
  const { id } = req.params;
  const ip = _ip(req);
  const { ganador = null, detalle_fin = null } = req.body ?? {};
  const ml = req.body?.marcador_local;
  const mv = req.body?.marcador_visitante;

  try {
    const [evento] = await query(`SELECT id, deporte, estado, fecha_inicio <= NOW() AS iniciado FROM eventos WHERE id = ? LIMIT 1`, [id]);
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
    if (['suspendido', 'cancelado'].includes(evento.estado))
      return res.status(409).json({ error: `El evento está ${evento.estado}` });
    if (!evento.iniciado) return res.status(409).json({ error: 'El evento aún no ha comenzado' });

    const tieneMarcador = ml !== undefined && ml !== null && ml !== '' && mv !== undefined && mv !== null && mv !== '';
    const gl = tieneMarcador ? Number(ml) : null;
    const gv = tieneMarcador ? Number(mv) : null;
    if (tieneMarcador && (!Number.isInteger(gl) || !Number.isInteger(gv) || gl < 0 || gv < 0 || gl > 250 || gv > 250))
      return res.status(400).json({ error: 'Marcador inválido' });
    if (ganador !== null && !GANADORES.includes(ganador))
      return res.status(400).json({ error: `ganador inválido. Válidos: ${GANADORES.join(', ')}` });
    if (!tieneMarcador && !ganador)
      return res.status(400).json({ error: 'Indica el marcador o el ganador' });
    if (detalle_fin !== null && !(DETALLES[evento.deporte] ?? []).includes(detalle_fin))
      return res.status(400).json({ error: 'detalle_fin no válido para este deporte' });

    const ganadorMarcador = tieneMarcador ? (gl > gv ? 'local' : gl < gv ? 'visitante' : 'empate') : null;
    if (ganador && ganadorMarcador && ganador !== ganadorMarcador)
      return res.status(400).json({ error: 'El ganador no coincide con el marcador' });

    await query(
      `UPDATE eventos SET estado = 'finalizado', resultado_final = ?, ganador_final = ?,
              detalle_fin_final = ?, updated_at = NOW()
        WHERE id = ?`,
      [tieneMarcador ? `${gl}-${gv}` : null, ganador ?? ganadorMarcador, detalle_fin, id]
    );
    const liquidacion = await liquidarEvento(Number(id));
    await _log(req.usuario.id, 'registrar_resultado', 'eventos', Number(id),
      { marcador: tieneMarcador ? `${gl}-${gv}` : null, ganador: ganador ?? ganadorMarcador, detalle_fin, liquidacion }, ip);

    req.app.get('io')?.emitirTodos('tickets_actualizados', { evento_id: Number(id) });
    return res.status(200).json({ mensaje: 'Resultado registrado', liquidacion });
  } catch (err) {
    console.error('[evento.controller] registrarResultado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listarEventos,
  obtenerEvento,
  crearEvento,
  actualizarEvento,
  toggleEvento,
  listarTorneos,
  toggleTorneo,
  listarCategorias,
  toggleCategoria,
  listarModalidades,
  toggleModalidad,
  actualizarCuotaModalidad,
  marcadoresEnVivo,
  listarCuotasMarcador,
  listarCuotasDetalle,
  listarPendientesResultado,
  registrarResultado,
};