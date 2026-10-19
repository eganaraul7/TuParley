import api from './api';

/**
 * bcvService — tasa de cambio BCV
 */
export const bcvService = {

  /**
   * actual — tasa BCV vigente del día
   * @returns {Promise<{ tasa: { valor: number, fuente: 'api'|'manual', fecha: string, es_de_hoy: boolean } | null,
   *                     rango: { minimo: number, maximo: number }, estado_api?: object }>}
   */
  async actual() {
    const { data } = await api.get('/bcv/actual');
    return data;
  },

  /**
   * setManual — (admin) forzar tasa manualmente si la API falla
   * @param {number} valor  Debe estar dentro del rango que devuelve /bcv/actual (validado en backend)
   * @returns {Promise<{ valor: number, tasa: object }>}
   */
  async setManual(valor) {
    const { data } = await api.post('/bcv/manual', { valor });
    return data;
  },

  /**
   * actualizarDesdeApi — (admin) consultar la API del BCV en este momento
   * @returns {Promise<{ valor: number, tasa: object }>}
   */
  async actualizarDesdeApi() {
    const { data } = await api.post('/bcv/actualizar');
    return data;
  },
};