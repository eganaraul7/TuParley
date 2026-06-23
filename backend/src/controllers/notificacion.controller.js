'use strict';

const { query } = require('../config/db');

// ─── GET /api/notificaciones ──────────────────────────────────────────────────

async function listarNotificaciones(req, res) {
  const { rol } = req.usuario;
  const { leido, tipo, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let sql = `SELECT id, tipo, mensaje, leido, destinatario_rol,
                      referencia_id, referencia_tipo, created_at
                  FROM notificaciones
                WHERE (destinatario_rol = ? OR destinatario_rol = 'ambos')`;
    const params = [rol];

    if (leido !== undefined) { sql += ' AND leido = ?';  params.push(leido === 'true' ? 1 : 0); }
    if (tipo)                { sql += ' AND tipo = ?';   params.push(tipo); }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const notificaciones = await query(sql, params);

    // Total no leídas
    const [{ total_no_leidas }] = await query(
      `SELECT COUNT(*) AS total_no_leidas FROM notificaciones
        WHERE (destinatario_rol = ? OR destinatario_rol = 'ambos') AND leido = 0`,
      [rol]
    );

    return res.status(200).json({ notificaciones, total_no_leidas, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[notificacion.controller] listarNotificaciones:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/notificaciones/:id/leer ──────────────────────────────────────

async function marcarLeida(req, res) {
  const { id } = req.params;
  try {
    const rows = await query(`SELECT id FROM notificaciones WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Notificación no encontrada' });

    await query(`UPDATE notificaciones SET leido = 1 WHERE id = ?`, [id]);
    return res.status(200).json({ mensaje: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('[notificacion.controller] marcarLeida:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/notificaciones/leer-todas ────────────────────────────────────

async function marcarTodasLeidas(req, res) {
  const { rol } = req.usuario;
  try {
    await query(
      `UPDATE notificaciones SET leido = 1
        WHERE (destinatario_rol = ? OR destinatario_rol = 'ambos') AND leido = 0`,
      [rol]
    );
    return res.status(200).json({ mensaje: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    console.error('[notificacion.controller] marcarTodasLeidas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── DELETE /api/notificaciones/:id ──────────────────────────────────────────

async function eliminarNotificacion(req, res) {
  const { id } = req.params;
  try {
    const rows = await query(`SELECT id FROM notificaciones WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Notificación no encontrada' });

    await query(`DELETE FROM notificaciones WHERE id = ?`, [id]);
    return res.status(200).json({ mensaje: 'Notificación eliminada' });
  } catch (err) {
    console.error('[notificacion.controller] eliminarNotificacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/notificaciones/conteo ──────────────────────────────────────────

async function conteoNoLeidas(req, res) {
  const { rol } = req.usuario;
  try {
    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM notificaciones
        WHERE (destinatario_rol = ? OR destinatario_rol = 'ambos') AND leido = 0`,
      [rol]
    );
    return res.status(200).json({ total_no_leidas: total });
  } catch (err) {
    console.error('[notificacion.controller] conteoNoLeidas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listarNotificaciones, marcarLeida, marcarTodasLeidas, eliminarNotificacion, conteoNoLeidas };