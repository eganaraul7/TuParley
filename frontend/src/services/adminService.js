import api from './api';

/**
 * adminService — modo mantenimiento global
 *
 * ⚠️ GET /admin/mantenimiento es endpoint nuevo, no estaba en el spec original
 * (solo existía el POST). Necesario para leer el estado actual al cargar el panel.
 */
export const adminService = {

  /**
   * getMantenimiento — estado actual del modo mantenimiento
   * @returns {Promise<{ activo: boolean }>}
   */
  async getMantenimiento() {
    const { data } = await api.get('/admin/mantenimiento');
    return data;
  },

  /**
   * setMantenimiento — (admin) activar/desactivar bloqueo global de tablets
   * @param {boolean} activo
   * @returns {Promise<{ activo: boolean }>}
   */
  async setMantenimiento(activo) {
    const { data } = await api.post('/admin/mantenimiento', { activo });
    return data;
  },
};