// Nombre de archivo: eventosService.js
// Ruta: frontend/src/services/eventosService.js
// Función: Servicios de eventos, categorías, torneos y modalidades.

import api from './api';

export const eventosService = {

  // ── Eventos ───────────────────────────────────────────────────────────────

  async listar(params = {}) {
    const { data } = await api.get('/eventos', { params });
    return data;
  },

  async obtenerPorId(id) {
    const { data } = await api.get(`/eventos/${id}`);
    return data;
  },

  async crear(payload) {
    const { data } = await api.post('/eventos', payload);
    return data;
  },

  async actualizar(id, payload) {
    const { data } = await api.put(`/eventos/${id}`, payload);
    return data;
  },

  async toggleEvento(id) {
    const { data } = await api.patch(`/eventos/${id}/toggle`);
    return data;
  },

  async marcadoresEnVivo() {
    const { data } = await api.get('/eventos/marcadores-en-vivo');
    return data;
  },

  // ── Categorías ────────────────────────────────────────────────────────────

  async listarCategorias() {
    const { data } = await api.get('/eventos/categorias/lista');
    return data;
  },

  async toggleCategoria(deporte) {
    const { data } = await api.patch(`/eventos/categorias/${deporte}/toggle`);
    return data;
  },

  // ── Torneos / Ligas ───────────────────────────────────────────────────────

  async listarTorneos(deporte) {
    const params = deporte ? { deporte } : {};
    const { data } = await api.get('/eventos/torneos/lista', { params });
    return data;
  },

  async toggleTorneo(id) {
    const { data } = await api.patch(`/eventos/torneos/${id}/toggle`);
    return data;
  },

  // ── Modalidades ───────────────────────────────────────────────────────────

  async listarModalidades(deporte) {
    const params = deporte ? { deporte } : {};
    const { data } = await api.get('/eventos/modalidades/lista', { params });
    return data;
  },

  async toggleModalidad(id) {
    const { data } = await api.patch(`/eventos/modalidades/${id}/toggle`);
    return data;
  },

  async actualizarCuota(id, cuota_base) {
    const { data } = await api.patch(`/eventos/modalidades/${id}/cuota`, { cuota_base });
    return data;
  },
};