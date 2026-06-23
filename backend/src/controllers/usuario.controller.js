'use strict';

const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { delCache, KEYS } = require('../config/redis');

// ─── helpers ─────────────────────────────────────────────────────────────────

async function _log(usuarioId, accion, entidad_afectada, entidad_id, detalle, ip) {
  await query(
    `INSERT INTO auditoria_logs (usuario_id, accion, entidad_afectada, entidad_id, detalle, ip_address)
      VALUES (?,?,?,?,?,?)`,
    [usuarioId ?? null, accion, entidad_afectada ?? null, entidad_id ?? null,
      detalle ? JSON.stringify(detalle) : null, ip ?? null]
  );
}

async function _notificar(tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo) {
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
      VALUES (?,?,?,?,?)`,
    [tipo, mensaje, destinatario_rol, referencia_id ?? null, referencia_tipo ?? null]
  );
}

function _ip(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
}

const ROLES_ADMIN   = ['computadora_madre', 'administrador'];
const ROLES_VALIDOS = ['computadora_madre', 'administrador', 'bodeguero', 'desconocido'];

// ─── POST /api/usuarios ───────────────────────────────────────────────────────

async function crearUsuario(req, res) {
  const { nombre_usuario, contrasena, rol = 'desconocido', bodega_id = null } = req.body;
  const ip = _ip(req);

  if (!nombre_usuario || !contrasena) {
    return res.status(400).json({ error: 'nombre_usuario y contrasena son requeridos' });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: `rol inválido. Válidos: ${ROLES_VALIDOS.join(', ')}` });
  }
  if (contrasena.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
  }

  // Solo computadora_madre puede crear otro computadora_madre
  if (rol === 'computadora_madre' && req.usuario.rol !== 'computadora_madre') {
    return res.status(403).json({ error: 'Solo la computadora madre puede asignar ese rol' });
  }

  try {
    // Verificar nombre_usuario único
    const existe = await query(`SELECT id FROM usuarios WHERE nombre_usuario = ? LIMIT 1`, [nombre_usuario]);
    if (existe.length > 0) {
      return res.status(409).json({ error: 'nombre_usuario ya existe' });
    }

    // Verificar bodega si se provee
    if (bodega_id) {
      const bodega = await query(`SELECT id FROM bodegas WHERE id = ? AND activa = 1 LIMIT 1`, [bodega_id]);
      if (bodega.length === 0) {
        return res.status(404).json({ error: 'Bodega no encontrada o inactiva' });
      }
    }

    const contrasena_hash = await bcrypt.hash(contrasena, 12);
    const result = await query(
      `INSERT INTO usuarios (nombre_usuario, contrasena_hash, rol, bodega_id) VALUES (?,?,?,?)`,
      [nombre_usuario, contrasena_hash, rol, bodega_id]
    );

    await _log(req.usuario.id, 'crear_usuario', 'usuarios', result.insertId,
      { nombre_usuario, rol, bodega_id }, ip);

    return res.status(201).json({
      mensaje: 'Usuario creado',
      usuario: { id: result.insertId, nombre_usuario, rol, bodega_id }
    });
  } catch (err) {
    console.error('[usuario.controller] crearUsuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/usuarios ────────────────────────────────────────────────────────

async function listarUsuarios(req, res) {
  try {
    const { rol, bodega_id, bloqueado } = req.query;
    let sql = `SELECT u.id, u.nombre_usuario, u.rol, u.bodega_id, u.bloqueado,
                      u.sesion_activa, u.ultimo_login, u.totp_habilitado, u.created_at,
                      b.nombre AS bodega_nombre, b.prefijo AS bodega_prefijo
                  FROM usuarios u
                  LEFT JOIN bodegas b ON b.id = u.bodega_id
                WHERE 1=1`;
    const params = [];

    if (rol)       { sql += ' AND u.rol = ?';       params.push(rol); }
    if (bodega_id) { sql += ' AND u.bodega_id = ?'; params.push(bodega_id); }
    if (bloqueado !== undefined) { sql += ' AND u.bloqueado = ?'; params.push(bloqueado === 'true' ? 1 : 0); }

    sql += ' ORDER BY u.created_at DESC';
    const usuarios = await query(sql, params);

    return res.status(200).json({ usuarios });
  } catch (err) {
    console.error('[usuario.controller] listarUsuarios:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/usuarios/:id ────────────────────────────────────────────────────

async function obtenerUsuario(req, res) {
  const { id } = req.params;

  // Bodeguero solo puede ver su propio perfil
  if (req.usuario.rol === 'bodeguero' && Number(id) !== req.usuario.id) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const rows = await query(
      `SELECT u.id, u.nombre_usuario, u.rol, u.bodega_id, u.bloqueado,
              u.sesion_activa, u.ultimo_login, u.totp_habilitado,
              u.intentos_fallidos, u.created_at, u.updated_at,
              b.nombre AS bodega_nombre, b.prefijo AS bodega_prefijo
          FROM usuarios u
          LEFT JOIN bodegas b ON b.id = u.bodega_id
        WHERE u.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.status(200).json({ usuario: rows[0] });
  } catch (err) {
    console.error('[usuario.controller] obtenerUsuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PUT /api/usuarios/:id ────────────────────────────────────────────────────

async function actualizarUsuario(req, res) {
  const { id } = req.params;
  const { nombre_usuario, bodega_id } = req.body;
  const ip = _ip(req);

  try {
    const rows = await query(`SELECT id, rol FROM usuarios WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const campos = [];
    const params = [];

    if (nombre_usuario) {
      const dup = await query(`SELECT id FROM usuarios WHERE nombre_usuario = ? AND id != ? LIMIT 1`, [nombre_usuario, id]);
      if (dup.length > 0) return res.status(409).json({ error: 'nombre_usuario ya existe' });
      campos.push('nombre_usuario = ?'); params.push(nombre_usuario);
    }
    if (bodega_id !== undefined) {
      campos.push('bodega_id = ?'); params.push(bodega_id);
    }

    if (campos.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(id);
    await query(`UPDATE usuarios SET ${campos.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    await _log(req.usuario.id, 'actualizar_usuario', 'usuarios', Number(id),
      { nombre_usuario, bodega_id }, ip);

    return res.status(200).json({ mensaje: 'Usuario actualizado' });
  } catch (err) {
    console.error('[usuario.controller] actualizarUsuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/usuarios/:id/rol ─────────────────────────────────────────────

async function asignarRol(req, res) {
  const { id } = req.params;
  const { rol, bodega_id } = req.body;
  const ip = _ip(req);

  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: `rol inválido. Válidos: ${ROLES_VALIDOS.join(', ')}` });
  }
  if (rol === 'computadora_madre' && req.usuario.rol !== 'computadora_madre') {
    return res.status(403).json({ error: 'Solo la computadora madre puede asignar ese rol' });
  }
  if (Number(id) === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
  }

  try {
    const rows = await query(`SELECT id, nombre_usuario, rol FROM usuarios WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const rolAnterior = rows[0].rol;

    let sql = 'UPDATE usuarios SET rol = ?, updated_at = NOW()';
    const params = [rol];

    if (rol === 'bodeguero' && bodega_id) {
      sql += ', bodega_id = ?';
      params.push(bodega_id);
    }
    sql += ' WHERE id = ?';
    params.push(id);

    await query(sql, params);
    await _log(req.usuario.id, 'asignar_rol', 'usuarios', Number(id),
      { rol_anterior: rolAnterior, rol_nuevo: rol, bodega_id }, ip);

    return res.status(200).json({ mensaje: `Rol actualizado: ${rolAnterior} → ${rol}` });
  } catch (err) {
    console.error('[usuario.controller] asignarRol:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/usuarios/:id/bloquear ────────────────────────────────────────

async function bloquearUsuario(req, res) {
  const { id } = req.params;
  const ip = _ip(req);

  if (Number(id) === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' });
  }

  try {
    const rows = await query(`SELECT id, nombre_usuario, rol FROM usuarios WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (rows[0].rol === 'computadora_madre') {
      return res.status(403).json({ error: 'No se puede bloquear a la computadora madre' });
    }

    await query(`UPDATE usuarios SET bloqueado = 1, updated_at = NOW() WHERE id = ?`, [id]);
    await _log(req.usuario.id, 'bloquear_usuario', 'usuarios', Number(id),
      { nombre_usuario: rows[0].nombre_usuario }, ip);

    return res.status(200).json({ mensaje: 'Usuario bloqueado' });
  } catch (err) {
    console.error('[usuario.controller] bloquearUsuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/usuarios/:id/desbloquear ─────────────────────────────────────

async function desbloquearUsuario(req, res) {
  const { id } = req.params;
  const ip = _ip(req);

  try {
    const rows = await query(`SELECT id, nombre_usuario FROM usuarios WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    await query(
      `UPDATE usuarios SET bloqueado = 0, intentos_fallidos = 0, updated_at = NOW() WHERE id = ?`,
      [id]
    );
    await delCache(KEYS.bloqueado(Number(id)));
    await _log(req.usuario.id, 'desbloquear_usuario', 'usuarios', Number(id),
      { nombre_usuario: rows[0].nombre_usuario }, ip);

    return res.status(200).json({ mensaje: 'Usuario desbloqueado' });
  } catch (err) {
    console.error('[usuario.controller] desbloquearUsuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/usuarios/:id/reset-contrasena ────────────────────────────────
// Admin resetea la contraseña de cualquier usuario

async function resetContrasena(req, res) {
  const { id } = req.params;
  const { contrasena_nueva } = req.body;
  const ip = _ip(req);

  if (!contrasena_nueva || contrasena_nueva.length < 8) {
    return res.status(400).json({ error: 'contrasena_nueva debe tener mínimo 8 caracteres' });
  }

  try {
    const rows = await query(`SELECT id, nombre_usuario FROM usuarios WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const nuevoHash = await bcrypt.hash(contrasena_nueva, 12);
    await query(`UPDATE usuarios SET contrasena_hash = ?, updated_at = NOW() WHERE id = ?`, [nuevoHash, id]);
    await _log(req.usuario.id, 'reset_contrasena', 'usuarios', Number(id),
      { nombre_usuario: rows[0].nombre_usuario }, ip);

    return res.status(200).json({ mensaje: 'Contraseña reseteada correctamente' });
  } catch (err) {
    console.error('[usuario.controller] resetContrasena:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── DELETE /api/usuarios/:id ─────────────────────────────────────────────────

async function eliminarUsuario(req, res) {
  const { id } = req.params;
  const ip = _ip(req);

  if (Number(id) === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }

  try {
    const rows = await query(`SELECT id, nombre_usuario, rol FROM usuarios WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (rows[0].rol === 'computadora_madre') {
      return res.status(403).json({ error: 'No se puede eliminar a la computadora madre' });
    }

    await query(`DELETE FROM usuarios WHERE id = ?`, [id]);
    await delCache(KEYS.sesion(Number(id)));
    await delCache(KEYS.bloqueado(Number(id)));
    await _log(req.usuario.id, 'eliminar_usuario', 'usuarios', Number(id),
      { nombre_usuario: rows[0].nombre_usuario, rol: rows[0].rol }, ip);

    return res.status(200).json({ mensaje: 'Usuario eliminado' });
  } catch (err) {
    console.error('[usuario.controller] eliminarUsuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/usuarios/solicitudes-reingreso ──────────────────────────────────

async function listarSolicitudesReingreso(req, res) {
  try {
    const { estado = 'pendiente' } = req.query;
    const rows = await query(
      `SELECT sr.id, sr.usuario_id, sr.hora_solicitud, sr.estado,
              sr.revisado_por, sr.fecha_revision, sr.created_at,
              u.nombre_usuario, u.bodega_id,
              b.nombre AS bodega_nombre
          FROM solicitudes_reingreso sr
          JOIN usuarios u ON u.id = sr.usuario_id
          LEFT JOIN bodegas b ON b.id = u.bodega_id
        WHERE sr.estado = ?
        ORDER BY sr.hora_solicitud DESC`,
      [estado]
    );
    return res.status(200).json({ solicitudes: rows });
  } catch (err) {
    console.error('[usuario.controller] listarSolicitudesReingreso:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/usuarios/solicitudes-reingreso/:id ───────────────────────────

async function responderSolicitudReingreso(req, res) {
  const { id } = req.params;
  const { decision } = req.body; // 'aprobada' | 'rechazada'
  const ip = _ip(req);

  if (!['aprobada', 'rechazada'].includes(decision)) {
    return res.status(400).json({ error: "decision debe ser 'aprobada' o 'rechazada'" });
  }

  try {
    const rows = await query(
      `SELECT sr.*, u.nombre_usuario FROM solicitudes_reingreso sr
          JOIN usuarios u ON u.id = sr.usuario_id
        WHERE sr.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (rows[0].estado !== 'pendiente') {
      return res.status(409).json({ error: 'Solicitud ya fue procesada' });
    }

    await query(
      `UPDATE solicitudes_reingreso
          SET estado = ?, revisado_por = ?, fecha_revision = NOW(), updated_at = NOW()
        WHERE id = ?`,
      [decision, req.usuario.id, id]
    );

    // Si se aprueba, resetear el cierre de caja de hoy para que pueda ingresar
    if (decision === 'aprobada') {
      const hoy = new Date().toISOString().split('T')[0];
      await query(
        `DELETE FROM cierre_caja WHERE usuario_id = ? AND fecha = ?`,
        [rows[0].usuario_id, hoy]
      );
    }

    await _log(req.usuario.id, `reingreso_${decision}`, 'solicitudes_reingreso', Number(id),
      { usuario: rows[0].nombre_usuario, decision }, ip);

    return res.status(200).json({ mensaje: `Solicitud ${decision}` });
  } catch (err) {
    console.error('[usuario.controller] responderSolicitudReingreso:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  crearUsuario,
  listarUsuarios,
  obtenerUsuario,
  actualizarUsuario,
  asignarRol,
  bloquearUsuario,
  desbloquearUsuario,
  resetContrasena,
  eliminarUsuario,
  listarSolicitudesReingreso,
  responderSolicitudReingreso,
};