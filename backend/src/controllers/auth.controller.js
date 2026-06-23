'use strict';

const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { query }                         = require('../config/db');
const { setCache, getCache, delCache, KEYS, TTL } = require('../config/redis');
const { JWT_SECRET, JWT_EXPIRES_IN }    = require('../config/env');

async function _logAuditoria(usuarioId, accion, entidad_afectada, entidad_id, detalle, ip) {
  await query(
    `INSERT INTO auditoria_logs (usuario_id, accion, entidad_afectada, entidad_id, detalle, ip_address)
      VALUES (?,?,?,?,?,?)`,
    [usuarioId ?? null, accion, entidad_afectada ?? null, entidad_id ?? null,
      detalle ? JSON.stringify(detalle) : null, ip ?? null]
  );
}

async function _crearNotificacion(tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo) {
  await query(
    `INSERT INTO notificaciones (tipo, mensaje, destinatario_rol, referencia_id, referencia_tipo)
      VALUES (?,?,?,?,?)`,
    [tipo, mensaje, destinatario_rol, referencia_id ?? null, referencia_tipo ?? null]
  );
}

function _obtenerIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
}

const MAX_INTENTOS = 5;
const ROLES_ADMIN  = ['computadora_madre', 'administrador'];

// ─── POST /api/auth/login ────────────────────────────────────────────────────

async function login(req, res) {
  const { nombre_usuario, contrasena, totp_code } = req.body;
  const ip = _obtenerIp(req);

  if (!nombre_usuario || !contrasena)
    return res.status(400).json({ error: 'Credenciales requeridas' });

  try {
    const rows = await query(
      `SELECT u.id, u.nombre_usuario, u.contrasena_hash, u.rol, u.bodega_id,
              u.bloqueado, u.intentos_fallidos, u.sesion_activa,
              u.hora_apertura_sesion, u.totp_secret, u.totp_habilitado,
              b.nombre  AS bodega_nombre,
              b.prefijo AS bodega_prefijo
         FROM usuarios u
         LEFT JOIN bodegas b ON b.id = u.bodega_id
        WHERE u.nombre_usuario = ? LIMIT 1`,
      [nombre_usuario]
    );
    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });

    if (usuario.bloqueado)
      return res.status(403).json({ error: 'Usuario bloqueado. Contacta al administrador.', bloqueado: true });

    const passwordValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);

    if (!passwordValida) {
      const nuevosIntentos = (usuario.intentos_fallidos || 0) + 1;
      if (nuevosIntentos >= MAX_INTENTOS) {
        await query(`UPDATE usuarios SET bloqueado = 1, intentos_fallidos = ? WHERE id = ?`, [nuevosIntentos, usuario.id]);
        await setCache(KEYS.bloqueado(usuario.id), '1', TTL.INTENTOS);
        await _crearNotificacion('usuario_bloqueado',
          `"${usuario.nombre_usuario}" bloqueado por ${MAX_INTENTOS} intentos fallidos. ¿Desbloquear?`,
          'ambos', usuario.id, 'usuarios');
        await _logAuditoria(usuario.id, 'login_bloqueado', 'usuarios', usuario.id, { intentos: nuevosIntentos }, ip);
        return res.status(403).json({ error: `Bloqueado tras ${MAX_INTENTOS} intentos fallidos.`, bloqueado: true });
      }
      await query(`UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?`, [nuevosIntentos, usuario.id]);
      return res.status(401).json({ error: 'Credenciales inválidas', intentos_restantes: MAX_INTENTOS - nuevosIntentos });
    }

    await query(`UPDATE usuarios SET intentos_fallidos = 0 WHERE id = ?`, [usuario.id]);

    if (ROLES_ADMIN.includes(usuario.rol) && usuario.totp_habilitado) {
      if (!totp_code)
        return res.status(200).json({ requiere_2fa: true, mensaje: 'Ingresa tu código 2FA' });
      const totpValido = speakeasy.totp.verify({
        secret: usuario.totp_secret, encoding: 'base32', token: String(totp_code), window: 1,
      });
      if (!totpValido) return res.status(401).json({ error: 'Código 2FA inválido' });
    }

    const mantenimiento = await getCache(KEYS.MANTENIMIENTO);
    if (mantenimiento === '1' && !ROLES_ADMIN.includes(usuario.rol))
      return res.status(503).json({ error: 'Sistema en mantenimiento.', mantenimiento: true });

    if (usuario.rol === 'bodeguero') {
      const ahora   = new Date();
      const minutos = ahora.getHours() * 60 + ahora.getMinutes();
      if (minutos < 300)
        return res.status(403).json({ error: 'Sistema no disponible hasta las 5:00 AM.', horario_bloqueado: true });
    }

    if (usuario.rol === 'bodeguero') {
      const hoy = new Date().toISOString().split('T')[0];
      const cierres = await query(
        `SELECT id FROM cierre_caja WHERE usuario_id = ? AND fecha = ? LIMIT 1`, [usuario.id, hoy]
      );
      if (cierres.length > 0) {
        const solicitudes = await query(
          `SELECT id FROM solicitudes_reingreso
            WHERE usuario_id = ? AND DATE(hora_solicitud) = ? AND estado = 'pendiente' LIMIT 1`,
          [usuario.id, hoy]
        );
        if (solicitudes.length === 0) {
          const ahoraISO = new Date();
          await query(
            `INSERT INTO solicitudes_reingreso (usuario_id, hora_solicitud, estado) VALUES (?,?,'pendiente')`,
            [usuario.id, ahoraISO]
          );
          const horaStr = ahoraISO.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
          await _crearNotificacion('solicitud_reingreso',
            `"${usuario.nombre_usuario}" desea reingresar a las ${horaStr}. ¿Permite acceso? [Sí] / [No]`,
            'ambos', usuario.id, 'usuarios');
        }
        return res.status(403).json({
          error: 'Sesión cerrada hoy. Se notificó al administrador para aprobar el reingreso.',
          reingreso_solicitado: true,
        });
      }
    }

    // ✅ FIX: hora_apertura_sesion incluida en el payload del JWT
    const ahoraLogin = new Date();
    const payload = {
      id:                   usuario.id,
      nombre_usuario:       usuario.nombre_usuario,
      rol:                  usuario.rol,
      bodega_id:            usuario.bodega_id,
      bodega_nombre:        usuario.bodega_nombre  ?? null,
      bodega_prefijo:       usuario.bodega_prefijo ?? null,
      hora_apertura_sesion: ahoraLogin.toISOString(),   // ← FIX
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN || '14h' });

    await query(
      `UPDATE usuarios SET sesion_activa = 1, hora_apertura_sesion = ?, ultimo_login = ? WHERE id = ?`,
      [ahoraLogin, ahoraLogin, usuario.id]
    );
    await setCache(KEYS.sesion(usuario.id), JSON.stringify(payload), TTL.SESION);
    await _logAuditoria(usuario.id, 'login_exitoso', 'usuarios', usuario.id, { rol: usuario.rol }, ip);

    return res.status(200).json({
      token,
      usuario: {
        id:                  usuario.id,
        nombre_usuario:      usuario.nombre_usuario,
        rol:                 usuario.rol,
        bodega_id:           usuario.bodega_id,
        bodega_nombre:       usuario.bodega_nombre  ?? null,
        bodega_prefijo:      usuario.bodega_prefijo ?? null,
        totp_habilitado:     usuario.totp_habilitado === 1,
        hora_apertura_sesion: ahoraLogin.toISOString(),
      },
    });
  } catch (err) {
    console.error('[auth.controller] login:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

async function logout(req, res) {
  const { id: usuarioId } = req.usuario;
  try {
    await query(`UPDATE usuarios SET sesion_activa = 0 WHERE id = ?`, [usuarioId]);
    await delCache(KEYS.sesion(usuarioId));
    await _logAuditoria(usuarioId, 'logout', 'usuarios', usuarioId, null, _obtenerIp(req));
    return res.status(200).json({ mensaje: 'Sesión cerrada' });
  } catch (err) {
    console.error('[auth.controller] logout:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

async function me(req, res) {
  return res.status(200).json({ usuario: req.usuario });
}

// ─── POST /api/auth/setup-2fa ────────────────────────────────────────────────

async function setup2fa(req, res) {
  const { id: usuarioId, rol, nombre_usuario } = req.usuario;
  if (!ROLES_ADMIN.includes(rol))
    return res.status(403).json({ error: 'Solo administradores pueden configurar 2FA' });
  try {
    const secret = speakeasy.generateSecret({ name: `TuParley:${nombre_usuario}`, length: 20 });
    await query(`UPDATE usuarios SET totp_secret = ? WHERE id = ?`, [secret.base32, usuarioId]);
    await _logAuditoria(usuarioId, '2fa_setup_iniciado', 'usuarios', usuarioId, null, _obtenerIp(req));
    return res.status(200).json({
      secret: secret.base32, otpauth_url: secret.otpauth_url,
      mensaje: 'Escanea el QR en Google Authenticator y confirma con /api/auth/verify-2fa',
    });
  } catch (err) {
    console.error('[auth.controller] setup2fa:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/auth/verify-2fa ───────────────────────────────────────────────

async function verify2fa(req, res) {
  const { id: usuarioId, rol } = req.usuario;
  const { totp_code } = req.body;
  if (!ROLES_ADMIN.includes(rol))
    return res.status(403).json({ error: 'Solo administradores pueden verificar 2FA' });
  if (!totp_code) return res.status(400).json({ error: 'Código requerido' });
  try {
    const rows = await query(`SELECT totp_secret FROM usuarios WHERE id = ? LIMIT 1`, [usuarioId]);
    if (!rows[0]?.totp_secret)
      return res.status(400).json({ error: 'Primero inicia la configuración con /api/auth/setup-2fa' });
    const valido = speakeasy.totp.verify({
      secret: rows[0].totp_secret, encoding: 'base32', token: String(totp_code), window: 1,
    });
    if (!valido) return res.status(401).json({ error: 'Código inválido' });
    await query(`UPDATE usuarios SET totp_habilitado = 1 WHERE id = ?`, [usuarioId]);
    await _logAuditoria(usuarioId, '2fa_habilitado', 'usuarios', usuarioId, null, _obtenerIp(req));
    return res.status(200).json({ mensaje: '2FA habilitado correctamente' });
  } catch (err) {
    console.error('[auth.controller] verify2fa:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── POST /api/auth/cambiar-contrasena ──────────────────────────────────────

async function cambiarContrasena(req, res) {
  const { id: usuarioId } = req.usuario;
  const { contrasena_actual, contrasena_nueva } = req.body;
  if (!contrasena_actual || !contrasena_nueva)
    return res.status(400).json({ error: 'Ambas contraseñas son requeridas' });
  if (contrasena_nueva.length < 8)
    return res.status(400).json({ error: 'Mínimo 8 caracteres' });
  try {
    const rows = await query(`SELECT contrasena_hash FROM usuarios WHERE id = ? LIMIT 1`, [usuarioId]);
    const valida = await bcrypt.compare(contrasena_actual, rows[0].contrasena_hash);
    if (!valida) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const nuevoHash = await bcrypt.hash(contrasena_nueva, 12);
    await query(`UPDATE usuarios SET contrasena_hash = ?, updated_at = NOW() WHERE id = ?`, [nuevoHash, usuarioId]);
    await _logAuditoria(usuarioId, 'cambio_contrasena', 'usuarios', usuarioId, null, _obtenerIp(req));
    return res.status(200).json({ mensaje: 'Contraseña actualizada' });
  } catch (err) {
    console.error('[auth.controller] cambiarContrasena:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login, logout, me, setup2fa, verify2fa, cambiarContrasena };