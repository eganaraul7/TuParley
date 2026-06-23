/**
 * roles.js — lógica de roles centralizada
 *
 * Único punto de verdad: antes duplicado en LoginPage, PendingApprovalPage y App.jsx.
 */

export const ROLES = {
  COMPUTADORA_MADRE: 'computadora_madre',
  ADMINISTRADOR:     'administrador',
  BODEGUERO:         'bodeguero',
  DESCONOCIDO:       'desconocido',
};

/**
 * rutaPorRol — a qué ruta debe ir un usuario según su rol tras login/rehidratación
 * @param {string} rol
 * @returns {string}
 */
export function rutaPorRol(rol) {
  if (rol === ROLES.DESCONOCIDO) return '/pending-approval';
  if (rol === ROLES.COMPUTADORA_MADRE || rol === ROLES.ADMINISTRADOR) return '/admin';
  if (rol === ROLES.BODEGUERO) return '/dashboard';
  return '/login';
}

/** @param {string} rol @returns {boolean} */
export function esAdmin(rol) {
  return rol === ROLES.COMPUTADORA_MADRE || rol === ROLES.ADMINISTRADOR;
}

/** @param {string} rol @returns {boolean} */
export function esBodeguero(rol) {
  return rol === ROLES.BODEGUERO;
}

/** @param {string} rol @returns {boolean} */
export function esDesconocido(rol) {
  return rol === ROLES.DESCONOCIDO;
}