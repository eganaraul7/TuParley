import api from './api';

/**
 * notificacionesService — alertas del panel admin (premios altos, bloqueos,
 * solicitudes de reingreso/anulación, discrepancias, eventos suspendidos, etc.)
 */
export const notificacionesService = {

  /**
   * listar
   * @returns {Promise<{ notificaciones: object[] }>}
   */
  async listar() {
    const { data } = await api.get('/notificaciones');
    return data;
  },

  /**
   * conteo — solo el número de no leídas (para badge)
   * @returns {Promise<{ total: number }>}
   */
  async conteo() {
    const { data } = await api.get('/notificaciones/conteo');
    return data;
  },

  /**
   * marcarLeida
   * @param {number} id
   */
  async marcarLeida(id) {
    const { data } = await api.patch(`/notificaciones/${id}/leer`);
    return data;
  },

  /**
   * marcarTodas
   */
  async marcarTodas() {
    const { data } = await api.patch('/notificaciones/leer-todas');
    return data;
  },

  /**
   * eliminar
   * @param {number} id
   */
  async eliminar(id) {
    const { data } = await api.delete(`/notificaciones/${id}`);
    return data;
  },
};