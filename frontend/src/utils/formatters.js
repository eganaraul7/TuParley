/**
 * formatters.js — formato de moneda, cuotas y fechas (es-VE)
 *
 * Único punto de verdad: antes duplicado en Dashboard/Historial/CierreCaja/AdminPage.
 * Fallback estándar para valores nulos: '—' (no string vacío).
 */

/** @param {number} n @returns {string} ej. "$45.00" */
export function fmtUsd(n) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

/** @param {number} n @returns {string} ej. "Bs 2034.50" */
export function fmtBs(n) {
  return `Bs ${Number(n ?? 0).toFixed(2)}`;
}

/** @param {number} n @returns {string} ej. "2.35" */
export function fmtCuota(n) {
  return Number(n ?? 0).toFixed(2);
}

/** @param {string} iso @returns {string} ej. "14:30" */
export function fmtHora(iso) {
  return iso
    ? new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';
}

/** @param {string} iso @returns {string} ej. "18 jun" */
export function fmtFecha(iso) {
  return iso
    ? new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
    : '—';
}

/** @param {string} iso @returns {string} ej. "18 jun, 14:30" — fecha + hora combinadas */
export function fmtDt(iso) {
  return iso
    ? new Date(iso).toLocaleString('es-VE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : '—';
}

/** @param {string} iso @returns {string} ej. "18 jun 2026, 14:30:05" — para timestamps exactos (cierre de caja) */
export function fmtDtCompleto(iso) {
  return iso
    ? new Date(iso).toLocaleString('es-VE', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : '—';
}