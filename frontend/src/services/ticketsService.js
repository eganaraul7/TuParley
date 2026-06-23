import api from './api';

/**
 * ticketsService — creación, consulta, pago y anulación de tickets
 */
export const ticketsService = {

  /**
   * crear — generar nuevo ticket (parlay con N selecciones)
   * @param {object} payload  Ver contrato exacto en DashboardPage.handleImprimir()
   *   {
   *     selecciones: [{ evento_id, modalidad_id, cuota_aplicada, seleccion }],
   *     monto_apostado_usd, monto_apostado_bs, tasa_bcv_dia,
   *     cuota_combinada, ganancia_potencial_usd, ganancia_potencial_bs,
   *     moneda_pago: 'USD'|'BS', origen: 'online'|'offline'
   *   }
   * @returns {Promise<{ ticket: object }>}
   */
  async crear(payload) {
    const { data } = await api.post('/tickets', payload);
    return data;
  },

  /**
   * sincronizarOffline — enviar lote de tickets generados sin conexión
   * Cada ticket debe incluir su hash_sha256 generado en el momento de creación
   * (verificado en backend antes de aceptar)
   * @param {object[]} tickets
   * @returns {Promise<{ aceptados: number, rechazados: object[] }>}
   */
  async sincronizarOffline(tickets) {
    const { data } = await api.post('/tickets/sync-offline', { tickets });
    return data;
  },

  /**
   * listar — historial paginado con filtros
   * @param {{ pagina?, limite?, estado?, serie?, fecha_desde?, fecha_hasta? }} params
   * @returns {Promise<{ tickets: object[], total: number }>}
   */
  async listar(params = {}) {
    const { data } = await api.get('/tickets', { params });
    return data;
  },

  /**
   * buscarPorSerie — búsqueda exacta por número de serie
   * @param {string} serie  ej. 'B1-1234-5678'
   * @returns {Promise<{ ticket: object }>}
   */
  async buscarPorSerie(serie) {
    const { data } = await api.get('/tickets/buscar', { params: { serie } });
    return data;
  },

  /**
   * obtenerPorId
   * @param {number} id
   * @returns {Promise<{ ticket: object }>}
   */
  async obtenerPorId(id) {
    const { data } = await api.get(`/tickets/${id}`);
    return data;
  },

  /**
   * pagar — registrar pago de premio (ticket en estado GANADO)
   * @param {number} ticketId
   * @param {{ moneda: 'USD'|'BS', cedula_foto_url?: string }} payload
   *   cedula_foto_url es obligatorio si ganancia_potencial_usd === 300
   * @returns {Promise<{ ticket: object, pago: object }>}
   */
  async pagar(ticketId, payload) {
    const { data } = await api.post(`/tickets/${ticketId}/pagar`, payload);
    return data;
  },

  /**
   * solicitarAnulacion — bodeguero solicita anular un ticket (requiere aprobación admin)
   * @param {number} ticketId
   * @param {string} motivo
   * @returns {Promise<{ solicitud: object }>}
   */
  async solicitarAnulacion(ticketId, motivo) {
    const { data } = await api.post(`/tickets/${ticketId}/solicitar-anulacion`, { motivo });
    return data;
  },

  /**
   * listarAnulaciones — (admin) ver todas las solicitudes de anulación
   * @returns {Promise<{ solicitudes: object[] }>}
   */
  async listarAnulaciones() {
    const { data } = await api.get('/tickets/anulaciones');
    return data;
  },

  /**
   * responderAnulacion — (admin) aprobar o rechazar una solicitud
   * @param {number} solicitudId
   * @param {'aprobada'|'rechazada'} estado
   * @returns {Promise<{ solicitud: object }>}
   */
  async responderAnulacion(solicitudId, estado) {
    const { data } = await api.patch(`/tickets/anulaciones/${solicitudId}`, { estado });
    return data;
  },
};