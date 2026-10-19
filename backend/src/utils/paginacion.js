'use strict';

/**
 * paginacion.js — normaliza page/limit para interpolarlos en SQL.
 * mysql2 + MySQL >= 8.0.22 rechaza `LIMIT ? OFFSET ?` en sentencias preparadas
 * ("Incorrect arguments to mysqld_stmt_execute"), así que se interpolan
 * enteros ya validados en lugar de usar placeholders.
 * Acepta también los alias en español que envía el frontend (pagina/limite).
 */
function paginacion(q = {}, { limitDefault = 50, limitMax = 200 } = {}) {
  const page  = Math.max(1, parseInt(q.page ?? q.pagina, 10) || 1);
  const limit = Math.min(limitMax, Math.max(1, parseInt(q.limit ?? q.limite, 10) || limitDefault));
  return { page, limit, offset: (page - 1) * limit, sql: ` LIMIT ${limit} OFFSET ${(page - 1) * limit}` };
}

module.exports = { paginacion };
