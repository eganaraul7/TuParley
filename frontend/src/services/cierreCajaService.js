import api from './api';

/**
 * cierreCajaService — resumen y registro de cierre de caja del bodeguero
 */
export const cierreCajaService = {

  /**
   * resumen — totales calculados por el sistema de la sesión activa
   * @returns {Promise<{ resumen: {
   *   tickets_vendidos, tickets_anulados, premios_pagados_usd,
   *   total_calculado_usd, total_calculado_bs, hora_apertura
   * } }>}
   */
  async resumen() {
    const { data } = await api.get('/cierre-caja/resumen');
    return data;
  },

  /**
   * registrar — bodeguero declara montos y confirma con contraseña
   * @param {{ total_usd_declarado: number, total_bs_declarado: number, contrasena: string }} payload
   * @returns {Promise<{ cierre: object }>}
   */
  async registrar(payload) {
    const { data } = await api.post('/cierre-caja', payload);
    return data;
  },

  /**
   * listar — (admin) historial de cierres de todas las bodegas
   * @param {{ pagina?, limite?, bodega_id?, fecha_desde?, fecha_hasta? }} params
   * @returns {Promise<{ cierres: object[], total: number }>}
   */
  async listar(params = {}) {
    const { data } = await api.get('/cierre-caja', { params });
    return data;
  },

  /**
   * obtenerPorId
   * @param {number} id
   * @returns {Promise<{ cierre: object }>}
   */
  async obtenerPorId(id) {
    const { data } = await api.get(`/cierre-caja/${id}`);
    return data;
  },
};