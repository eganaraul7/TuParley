import api from './api';

/**
 * reportesService — reportes JSON (vista) y descargables PDF/Word (admin)
 *
 * ⚠️ Fix de spec: /reportes/pdf y /reportes/word no tenían parámetro de tipo.
 * Se agrega query `?tipo=` para indicar diario|semanal|mensual|estadisticas.
 * Backend: GET /reportes/pdf?tipo=mensual → genera el PDF correspondiente.
 */
export const reportesService = {

  // ── datos JSON (vista en pantalla, no descarga) ─────────────────────────────

  /** @returns {Promise<{ reporte: object }>} */
  async obtenerDiario() {
    const { data } = await api.get('/reportes/diario');
    return data;
  },

  /** @returns {Promise<{ reporte: object }>} */
  async obtenerSemanal() {
    const { data } = await api.get('/reportes/semanal');
    return data;
  },

  /** @returns {Promise<{ reporte: object }>} */
  async obtenerMensual() {
    const { data } = await api.get('/reportes/mensual');
    return data;
  },

  /** @returns {Promise<{ estadisticas: object[] }>} */
  async obtenerEstadisticasMensuales() {
    const { data } = await api.get('/reportes/estadisticas-mensuales');
    return data;
  },

  // ── descarga de archivo (PDF / Word) ────────────────────────────────────────

  /**
   * descargar — genera y descarga el archivo del periodo solicitado
   * @param {'diario'|'semanal'|'mensual'|'estadisticas'} periodo
   * @param {'pdf'|'word'} formato
   * @returns {Promise<Blob>}
   */
  async descargar(periodo, formato) {
    const ruta = formato === 'pdf' ? '/reportes/pdf' : '/reportes/word';
    const { data } = await api.get(ruta, {
      params: { tipo: periodo },
      responseType: 'blob',
    });
    return data;
  },
};