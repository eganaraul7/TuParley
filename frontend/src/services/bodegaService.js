import api from './api';

export const bodegaService = {

  async listar() {
    const { data } = await api.get('/bodegas');
    return data;
  },

  async obtenerConfigImpresion(bodegaId) {
    const { data } = await api.get(`/bodegas/${bodegaId}/config-impresion`);
    return data;
  },

  async actualizarConfigImpresion(bodegaId, payload) {
    // payload: { fisica_activa?: boolean, digital_activa?: boolean }
    const { data } = await api.patch(`/bodegas/${bodegaId}/config-impresion`, payload);
    return data;
  },
};