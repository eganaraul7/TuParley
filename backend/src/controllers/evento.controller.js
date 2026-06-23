'use strict';

const { query } = require('../config/db');

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
  return (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
}

const DEPORTES_VALIDOS = ['futbol', 'baloncesto', 'beisbol', 'caballos', 'tenis'];

// ─── GET /api/eventos ─────────────────────────────────────────────────────────
// Retorna eventos de la semana actual, filtrables

async function listarEventos(req, res) {
  const { deporte, liga, equipo, fecha, estado } = req.query;

  try {
    // Rango máximo: 7 días desde hoy
    const hoy          = new Date();
    const en7Dias      = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fechaDesde   = hoy.toISOString().slice(0, 19).replace('T', ' ');
    const fechaHasta   = en7Dias.toISOString().slice(0, 19).replace('T', ' ');

    let sql = `SELECT e.id, e.api_evento_id, e.deporte, e.liga,
                      e.equipo_local, e.equipo_visitante, e.fecha_inicio,
                      e.estado, e.activo,
                      cc.activa AS categoria_activa
                  FROM eventos e
                  JOIN categorias_config cc ON cc.deporte = e.deporte
                WHERE e.fecha_inicio BETWEEN ? AND ?`;
    const params = [fechaDesde, fechaHasta];

    if (deporte) { sql += ' AND e.deporte = ?';                              params.push(deporte); }
    if (liga)    { sql += ' AND e.liga LIKE ?';                              params.push(`%${liga}%`); }
    if (equipo)  { sql += ' AND (e.equipo_local LIKE ? OR e.equipo_visitante LIKE ?)'; params.push(`%${equipo}%`, `%${equipo}%`); }
    if (fecha)   { sql += ' AND DATE(e.fecha_inicio) = ?';                   params.push(fecha); }
    if (estado)  { sql += ' AND e.estado = ?';                               params.push(estado); }
    else         { sql += " AND e.estado = 'programado' AND e.activo = 1 AND cc.activa = 1"; }

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
// Admin crea evento manual

async function crearEvento(req, res) {
  const { deporte, liga, equipo_local, equipo_visitante, fecha_inicio, api_evento_id } = req.body;
  const ip = _ip(req);

  if (!deporte || !liga || !equipo_local || !equipo_visitante || !fecha_inicio) {
    return res.status(400).json({ error: 'deporte, liga, equipo_local, equipo_visitante y fecha_inicio son requeridos' });
  }
  if (!DEPORTES_VALIDOS.includes(deporte)) {
    return res.status(400).json({ error: `deporte inválido. Válidos: ${DEPORTES_VALIDOS.join(', ')}` });
  }

  try {
    const result = await query(
      `INSERT INTO eventos (api_evento_id, deporte, liga, equipo_local, equipo_visitante, fecha_inicio, estado, activo)
       VALUES (?,?,?,?,?,?,'programado',1)`,
      [api_evento_id ?? null, deporte, liga, equipo_local, equipo_visitante, fecha_inicio]
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
  const { liga, equipo_local, equipo_visitante, fecha_inicio, estado, resultado_final } = req.body;
  const ip = _ip(req);

  try {
    const rows = await query(`SELECT id FROM eventos WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Evento no encontrado' });

    const campos = []; const params = [];
    if (liga)             { campos.push('liga = ?');             params.push(liga); }
    if (equipo_local)     { campos.push('equipo_local = ?');     params.push(equipo_local); }
    if (equipo_visitante) { campos.push('equipo_visitante = ?'); params.push(equipo_visitante); }
    if (fecha_inicio)     { campos.push('fecha_inicio = ?');     params.push(fecha_inicio); }
    if (resultado_final)  { campos.push('resultado_final = ?');  params.push(resultado_final); }
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
    await _log(req.usuario.id, 'actualizar_evento', 'eventos', Number(id), req.body, ip);

    return res.status(200).json({ mensaje: 'Evento actualizado' });
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
                      cuota_maxima, dificultad, activa FROM modalidades WHERE 1=1`;
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

module.exports = {
  listarEventos,
  obtenerEvento,
  crearEvento,
  actualizarEvento,
  toggleEvento,
  listarCategorias,
  toggleCategoria,
  listarModalidades,
  toggleModalidad,
  actualizarCuotaModalidad,
  marcadoresEnVivo,
};