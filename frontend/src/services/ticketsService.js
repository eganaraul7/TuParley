import api from './api';

export const ticketsService = {

  async crear(payload) {
    const { data } = await api.post('/tickets', payload);
    return data;
  },

  // Bug fix: backend espera { cola }, no { tickets }
  async sincronizarOffline(tickets) {
    const { data } = await api.post('/tickets/sync-offline', { cola: tickets });
    return data;
  },

  async listar(params = {}) {
    const { data } = await api.get('/tickets', { params });
    return data;
  },

  async buscarPorSerie(serie) {
    const { data } = await api.get('/tickets/buscar', { params: { serie } });
    return data;
  },

  async obtenerPorId(id) {
    const { data } = await api.get(`/tickets/${id}`);
    return data;
  },

  async actualizarModoImpresion(id, modo) {
    if (!id) return;
    const { data } = await api.patch(`/tickets/${id}/modo-impresion`, { modo_impresion: modo });
    return data;
  },

  async consultarQR(serie) {
    const { data } = await api.get(`/tickets/qr/${encodeURIComponent(serie)}`);
    return data;
  },

  async pagar(ticketId, payload) {
    const { data } = await api.post(`/tickets/${ticketId}/pagar`, payload);
    return data;
  },

  async solicitarAnulacion(ticketId, motivo) {
    const { data } = await api.post(`/tickets/${ticketId}/solicitar-anulacion`, { motivo });
    return data;
  },

  async listarAnulaciones() {
    const { data } = await api.get('/tickets/anulaciones');
    return data;
  },

  async responderAnulacion(solicitudId, estado) {
    const { data } = await api.patch(`/tickets/anulaciones/${solicitudId}`, { estado });
    return data;
  },
};