import api from './api';

/**
 * bcvService — tasa de cambio BCV
 */
export const bcvService = {

  /**
   * actual — tasa BCV vigente del día
   * @returns {Promise<{ tasa: { valor: number, fuente: 'api'|'manual', fecha: string, validada: boolean } }>}
   */
  async actual() {
    const { data } = await api.get('/bcv/actual');
    return data;
  },

  /**
   * setManual — (admin) forzar tasa manualmente si la API falla
   * @param {number} valor  Debe estar entre 30 y 200 Bs/$ (validado también en backend)
   * @returns {Promise<{ tasa: object }>}
   */
  async setManual(valor) {
    const { data } = await api.post('/bcv/manual', { valor });
    return data;
  },
};