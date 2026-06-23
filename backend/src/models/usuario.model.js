'use strict';

const { query } = require('../config/db');

const UsuarioModel = {
  findById: (id) =>
    query(`SELECT u.*, b.nombre AS bodega_nombre, b.prefijo AS bodega_prefijo
              FROM usuarios u LEFT JOIN bodegas b ON b.id = u.bodega_id
            WHERE u.id = ? LIMIT 1`, [id]).then(r => r[0] ?? null),

  findByUsername: (nombre_usuario) =>
    query(`SELECT u.*, b.nombre AS bodega_nombre, b.prefijo AS bodega_prefijo
              FROM usuarios u LEFT JOIN bodegas b ON b.id = u.bodega_id
            WHERE u.nombre_usuario = ? LIMIT 1`, [nombre_usuario]).then(r => r[0] ?? null),

  findAll: (filtros = {}) => {
    let sql = `SELECT u.id, u.nombre_usuario, u.rol, u.bodega_id, u.bloqueado,
                      u.sesion_activa, u.ultimo_login, u.totp_habilitado, u.created_at,
                      b.nombre AS bodega_nombre, b.prefijo AS bodega_prefijo
                  FROM usuarios u LEFT JOIN bodegas b ON b.id = u.bodega_id WHERE 1=1`;
    const params = [];
    if (filtros.rol)      { sql += ' AND u.rol = ?';       params.push(filtros.rol); }
    if (filtros.bodega_id){ sql += ' AND u.bodega_id = ?'; params.push(filtros.bodega_id); }
    if (filtros.bloqueado !== undefined) { sql += ' AND u.bloqueado = ?'; params.push(filtros.bloqueado ? 1 : 0); }
    return query(sql + ' ORDER BY u.created_at DESC', params);
  },

  create: (data) =>
    query(`INSERT INTO usuarios (nombre_usuario, contrasena_hash, rol, bodega_id) VALUES (?,?,?,?)`,
      [data.nombre_usuario, data.contrasena_hash, data.rol ?? 'desconocido', data.bodega_id ?? null]),

  update: (id, campos) => {
    const keys = Object.keys(campos);
    if (keys.length === 0) return Promise.resolve(null);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    return query(`UPDATE usuarios SET ${sets}, updated_at = NOW() WHERE id = ?`,
      [...Object.values(campos), id]);
  },

  delete: (id) => query(`DELETE FROM usuarios WHERE id = ?`, [id]),

  incrementarIntentos: (id) =>
    query(`UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1 WHERE id = ?`, [id]),

  resetIntentos: (id) =>
    query(`UPDATE usuarios SET intentos_fallidos = 0 WHERE id = ?`, [id]),

  bloquear: (id) =>
    query(`UPDATE usuarios SET bloqueado = 1, updated_at = NOW() WHERE id = ?`, [id]),

  desbloquear: (id) =>
    query(`UPDATE usuarios SET bloqueado = 0, intentos_fallidos = 0, updated_at = NOW() WHERE id = ?`, [id]),

  abrirSesion: (id, ahora) =>
    query(`UPDATE usuarios SET sesion_activa = 1, hora_apertura_sesion = ?, ultimo_login = ?, updated_at = NOW() WHERE id = ?`,
      [ahora, ahora, id]),

  cerrarSesion: (id) =>
    query(`UPDATE usuarios SET sesion_activa = 0, hora_apertura_sesion = NULL, updated_at = NOW() WHERE id = ?`, [id]),

  setTotpSecret: (id, secret) =>
    query(`UPDATE usuarios SET totp_secret = ? WHERE id = ?`, [secret, id]),

  habilitarTotp: (id) =>
    query(`UPDATE usuarios SET totp_habilitado = 1, updated_at = NOW() WHERE id = ?`, [id]),

  setContrasena: (id, hash) =>
    query(`UPDATE usuarios SET contrasena_hash = ?, updated_at = NOW() WHERE id = ?`, [hash, id]),
};

module.exports = UsuarioModel;