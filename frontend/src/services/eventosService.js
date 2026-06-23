import api from './api';

/**
 * eventosService — eventos deportivos, categorías y modalidades
 */
export const eventosService = {

  // ── eventos ──────────────────────────────────────────────────────────────────

  /**
   * listar — eventos con filtros opcionales
   * @param {{ deporte?, liga?, equipo?, fecha?, estado?, limite? }} params
   * @returns {Promise<{ eventos: object[], total: number }>}
   */
  async listar(params = {}) {
    const { data } = await api.get('/eventos', { params });
    return data;
  },

  /**
   * obtenerPorId
   * @param {number} id
   * @returns {Promise<{ evento: object }>}
   */
  async obtenerPorId(id) {
    const { data } = await api.get(`/eventos/${id}`);
    return data;
  },

  /**
   * crear — (admin) registrar evento manualmente
   * @param {object} payload  { deporte, liga, equipo_local, equipo_visitante, fecha_inicio, api_evento_id? }
   * @returns {Promise<{ evento: object }>}
   */
  async crear(payload) {
    const { data } = await api.post('/eventos', payload);
    return data;
  },

  /**
   * actualizar — (admin) editar evento existente
   * @param {number} id
   * @param {object} payload
   * @returns {Promise<{ evento: object }>}
   */
  async actualizar(id, payload) {
    const { data } = await api.put(`/eventos/${id}`, payload);
    return data;
  },

  /**
   * toggleEvento — (admin) activar/desactivar un evento puntual
   * @param {number} id
   * @returns {Promise<{ evento: object }>}
   */
  async toggleEvento(id) {
    const { data } = await api.patch(`/eventos/${id}/toggle`);
    return data;
  },

  /**
   * marcadoresEnVivo — eventos en_curso con resultado parcial en tiempo real
   * @returns {Promise<{ eventos: object[] }>}
   */
  async marcadoresEnVivo() {
    const { data } = await api.get('/eventos/marcadores-en-vivo');
    return data;
  },

  // ── categorías (deportes) ────────────────────────────────────────────────────

  /**
   * listarCategorias — estado activo/inactivo de los 5 deportes
   * @returns {Promise<{ categorias: object[] }>}
   */
  async listarCategorias() {
    const { data } = await api.get('/eventos/categorias/lista');
    return data;
  },

  /**
   * toggleCategoria — (admin) activar/desactivar un deporte completo
   * @param {string} deporte  'futbol'|'baloncesto'|'beisbol'|'caballos'|'tenis'
   * @returns {Promise<{ categoria: object }>}
   */
  async toggleCategoria(deporte) {
    const { data } = await api.patch(`/eventos/categorias/${deporte}/toggle`);
    return data;
  },

  // ── modalidades ──────────────────────────────────────────────────────────────

  /**
   * listarModalidades — modalidades de apuesta, opcionalmente filtradas por deporte
   * @param {string} [deporte]  Si se omite, retorna las 25 modalidades de los 5 deportes
   * @returns {Promise<{ modalidades: object[] }>}
   */
  async listarModalidades(deporte) {
    const params = deporte ? { deporte } : {};
    const { data } = await api.get('/eventos/modalidades/lista', { params });
    return data;
  },

  /**
   * toggleModalidad — (admin) activar/desactivar una modalidad puntual
   * @param {number} id
   * @returns {Promise<{ modalidad: object }>}
   */
  async toggleModalidad(id) {
    const { data } = await api.patch(`/eventos/modalidades/${id}/toggle`);
    return data;
  },

  /**
   * actualizarCuota — (admin) cambiar cuota_base de una modalidad
   * @param {number} id
   * @param {number} cuota_base
   * @returns {Promise<{ modalidad: object }>}
   */
  async actualizarCuota(id, cuota_base) {
    const { data } = await api.patch(`/eventos/modalidades/${id}/cuota`, { cuota_base });
    return data;
  },
};