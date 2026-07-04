'use strict';
const { query } = require('../config/db');

async function _log(usuarioId, accion, entidad_id, detalle, ip) {
  await query(
    `INSERT INTO auditoria_logs (usuario_id, accion, entidad_afectada, entidad_id, detalle, ip_address)
      VALUES (?,?,?,?,?,?)`,
    [usuarioId ?? null, accion, 'config_impresion_bodega', entidad_id ?? null,
      detalle ? JSON.stringify(detalle) : null, ip ?? null]
  );
}

function _ip(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
}

// ─── GET /api/bodegas ─────────────────────────────────────────────────────────

async function listarBodegas(req, res) {
  try {
    const bodegas = await query(
      `SELECT b.id, b.nombre, b.ubicacion, b.activa,
              cib.fisica_activa, cib.digital_activa
         FROM bodegas b
         LEFT JOIN config_impresion_bodega cib ON cib.bodega_id = b.id
        ORDER BY b.nombre ASC`
    );
    return res.status(200).json({ bodegas });
  } catch (err) {
    console.error('[bodega.controller] listarBodegas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── GET /api/bodegas/:id/config-impresion ────────────────────────────────────

async function obtenerConfigImpresion(req, res) {
  const { id }                               = req.params;
  const { rol, bodega_id: bodegaUsuario }    = req.usuario;

  if (rol === 'bodeguero' && Number(id) !== Number(bodegaUsuario)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    let rows = await query(
      `SELECT fisica_activa, digital_activa, updated_at
         FROM config_impresion_bodega
        WHERE bodega_id = ? LIMIT 1`,
      [id]
    );

    // Crear fila por defecto si aún no existe
    if (rows.length === 0) {
      await query(
        `INSERT IGNORE INTO config_impresion_bodega (bodega_id, fisica_activa, digital_activa)
          VALUES (?, 1, 1)`,
        [id]
      );
      rows = [{ fisica_activa: 1, digital_activa: 1, updated_at: new Date() }];
    }

    return res.status(200).json({ config: rows[0] });
  } catch (err) {
    console.error('[bodega.controller] obtenerConfigImpresion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── PATCH /api/bodegas/:id/config-impresion ──────────────────────────────────

async function actualizarConfigImpresion(req, res) {
  const { id }                            = req.params;
  const { fisica_activa, digital_activa } = req.body;
  const { rol, bodega_id: bodegaUsuario } = req.usuario;
  const ip                                = _ip(req);

  if (rol === 'bodeguero' && Number(id) !== Number(bodegaUsuario)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  if (fisica_activa === undefined && digital_activa === undefined) {
    return res.status(400).json({ error: 'Se requiere fisica_activa o digital_activa' });
  }

  const nuevaFisica  = fisica_activa  !== undefined ? (fisica_activa  ? 1 : 0) : null;
  const nuevaDigital = digital_activa !== undefined ? (digital_activa ? 1 : 0) : null;

  // Verificar que al menos un modo quede activo después del cambio
  if (nuevaFisica === 0 && nuevaDigital === 0) {
    return res.status(400).json({
      error: 'Al menos un modo de impresión debe permanecer activo',
    });
  }

  // Si solo viene un campo, leer el actual para validar el par
  if (nuevaFisica === null || nuevaDigital === null) {
    try {
      const actual = await query(
        `SELECT fisica_activa, digital_activa FROM config_impresion_bodega WHERE bodega_id = ? LIMIT 1`,
        [id]
      );
      if (actual.length > 0) {
        const f = nuevaFisica  !== null ? nuevaFisica  : actual[0].fisica_activa;
        const d = nuevaDigital !== null ? nuevaDigital : actual[0].digital_activa;
        if (!f && !d) {
          return res.status(400).json({
            error: 'Al menos un modo de impresión debe permanecer activo',
          });
        }
      }
    } catch { /* continúa, el upsert pondrá defaults */ }
  }

  try {
    await query(
      `INSERT INTO config_impresion_bodega
          (bodega_id, fisica_activa, digital_activa, actualizado_por)
         VALUES (?, COALESCE(?,1), COALESCE(?,1), ?)
         ON DUPLICATE KEY UPDATE
           fisica_activa   = COALESCE(?, fisica_activa),
           digital_activa  = COALESCE(?, digital_activa),
           actualizado_por = ?,
           updated_at      = NOW()`,
      [id, nuevaFisica, nuevaDigital, req.usuario.id,
           nuevaFisica, nuevaDigital, req.usuario.id]
    );

    await _log(req.usuario.id, 'actualizar_config_impresion', Number(id),
      { fisica_activa: nuevaFisica, digital_activa: nuevaDigital }, ip);

    return res.status(200).json({ mensaje: 'Configuración de impresión actualizada' });
  } catch (err) {
    console.error('[bodega.controller] actualizarConfigImpresion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listarBodegas,
  obtenerConfigImpresion,
  actualizarConfigImpresion,
};