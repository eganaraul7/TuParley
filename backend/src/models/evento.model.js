'use strict';

const { query } = require('../config/db');

const EventoModel = {
  findById: (id) =>
    query(`SELECT e.*, cc.activa AS categoria_activa
              FROM eventos e
              JOIN categorias_config cc ON cc.deporte = e.deporte
            WHERE e.id = ? LIMIT 1`, [id]).then(r => r[0] ?? null),

  findByApiId: (api_evento_id) =>
    query(`SELECT * FROM eventos WHERE api_evento_id = ? LIMIT 1`, [api_evento_id]).then(r => r[0] ?? null),

  findDisponibles: (filtros = {}) => {
    const hoy     = new Date();
    const en7Dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
    let sql = `SELECT e.*, cc.activa AS categoria_activa
                  FROM eventos e
                  JOIN categorias_config cc ON cc.deporte = e.deporte
                WHERE e.fecha_inicio BETWEEN ? AND ?
                  AND e.estado = 'programado' AND e.activo = 1 AND cc.activa = 1`;
    const params = [
      hoy.toISOString().slice(0, 19).replace('T', ' '),
      en7Dias.toISOString().slice(0, 19).replace('T', ' '),
    ];
    if (filtros.deporte) { sql += ' AND e.deporte = ?'; params.push(filtros.deporte); }
    if (filtros.liga)    { sql += ' AND e.liga LIKE ?'; params.push(`%${filtros.liga}%`); }
    if (filtros.equipo)  { sql += ' AND (e.equipo_local LIKE ? OR e.equipo_visitante LIKE ?)'; params.push(`%${filtros.equipo}%`, `%${filtros.equipo}%`); }
    if (filtros.fecha)   { sql += ' AND DATE(e.fecha_inicio) = ?'; params.push(filtros.fecha); }
    return query(sql + ' ORDER BY e.fecha_inicio ASC', params);
  },

  findEnCurso: () =>
    query(`SELECT * FROM eventos WHERE estado = 'en_curso' ORDER BY fecha_inicio ASC`),

  create: (data) =>
    query(`INSERT INTO eventos (api_evento_id, deporte, liga, equipo_local, equipo_visitante, fecha_inicio, estado, activo)
            VALUES (?,?,?,?,?,?,'programado',1)`,
      [data.api_evento_id ?? null, data.deporte, data.liga, data.equipo_local, data.equipo_visitante, data.fecha_inicio]),

  update: (id, campos) => {
    const keys = Object.keys(campos);
    if (keys.length === 0) return Promise.resolve(null);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    return query(`UPDATE eventos SET ${sets}, updated_at = NOW() WHERE id = ?`,
      [...Object.values(campos), id]);
  },

  toggleActivo: (id, activo) =>
    query(`UPDATE eventos SET activo = ?, updated_at = NOW() WHERE id = ?`, [activo, id]),

  updateEstado: (id, estado, resultado_final = null) =>
    query(`UPDATE eventos SET estado = ?, resultado_final = ?, updated_at = NOW() WHERE id = ?`,
      [estado, resultado_final, id]),

  cerrarApuestasEventosIniciados: () =>
    query(`UPDATE eventos SET estado = 'en_curso', updated_at = NOW()
            WHERE estado = 'programado' AND fecha_inicio <= NOW() AND activo = 1`),

  getTicketsPorEvento: (evento_id) =>
    query(`SELECT DISTINCT t.id, t.estado, t.bodega_id, t.numero_serie
              FROM tickets t
              JOIN selecciones_ticket st ON st.ticket_id = t.id
            WHERE st.evento_id = ? AND t.estado = 'PENDIENTE'`, [evento_id]),

  getModalidades: (deporte) =>
    query(`SELECT * FROM modalidades WHERE deporte = ? AND activa = 1 ORDER BY dificultad`, [deporte]),

  toggleCategoria: (deporte, activa, usuario_id) =>
    query(`UPDATE categorias_config SET activa = ?, actualizado_por = ?, updated_at = NOW() WHERE deporte = ?`,
      [activa, usuario_id, deporte]),

  getCategorias: () =>
    query(`SELECT cc.*, u.nombre_usuario AS actualizado_por_nombre
              FROM categorias_config cc
              LEFT JOIN usuarios u ON u.id = cc.actualizado_por`),

  toggleModalidad: (id, activa) =>
    query(`UPDATE modalidades SET activa = ?, updated_at = NOW() WHERE id = ?`, [activa, id]),

  updateCuotaModalidad: (id, campos) =>
    query(`UPDATE modalidades SET cuota_base = ?, cuota_minima = ?, cuota_maxima = ?, updated_at = NOW() WHERE id = ?`,
      [campos.cuota_base, campos.cuota_minima ?? null, campos.cuota_maxima ?? null, id]),
};

module.exports = EventoModel;