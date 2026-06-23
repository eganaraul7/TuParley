import api from './api';

/**
 * usuariosService — gestión de usuarios y solicitudes de reingreso (admin)
 */
export const usuariosService = {

  /**
   * listar
   * @returns {Promise<{ usuarios: object[] }>}
   */
  async listar() {
    const { data } = await api.get('/usuarios');
    return data;
  },

  /**
   * obtenerPorId
   * @param {number} id
   * @returns {Promise<{ usuario: object }>}
   */
  async obtenerPorId(id) {
    const { data } = await api.get(`/usuarios/${id}`);
    return data;
  },

  /**
   * crear
   * @param {{ nombre_usuario, contrasena, rol, bodega_id? }} payload
   * @returns {Promise<{ usuario: object }>}
   */
  async crear(payload) {
    const { data } = await api.post('/usuarios', payload);
    return data;
  },

  /**
   * actualizar
   * @param {number} id
   * @param {object} payload
   * @returns {Promise<{ usuario: object }>}
   */
  async actualizar(id, payload) {
    const { data } = await api.put(`/usuarios/${id}`, payload);
    return data;
  },

  /**
   * cambiarRol
   * @param {number} id
   * @param {'administrador'|'bodeguero'|'desconocido'} rol
   * @returns {Promise<{ usuario: object }>}
   */
  async cambiarRol(id, rol) {
    const { data } = await api.patch(`/usuarios/${id}/rol`, { rol });
    return data;
  },

  /**
   * bloquear
   * @param {number} id
   * @returns {Promise<{ usuario: object }>}
   */
  async bloquear(id) {
    const { data } = await api.patch(`/usuarios/${id}/bloquear`);
    return data;
  },

  /**
   * desbloquear
   * @param {number} id
   * @returns {Promise<{ usuario: object }>}
   */
  async desbloquear(id) {
    const { data } = await api.patch(`/usuarios/${id}/desbloquear`);
    return data;
  },

  /**
   * resetContrasena — admin fuerza nueva contraseña tras bloqueo
   * @param {number} id
   * @param {string} nuevaContrasena
   * @returns {Promise<{ usuario: object }>}
   */
  async resetContrasena(id, nuevaContrasena) {
    const { data } = await api.patch(`/usuarios/${id}/reset-contrasena`, {
      contrasena_nueva: nuevaContrasena,
    });
    return data;
  },

  /**
   * eliminar
   * @param {number} id
   */
  async eliminar(id) {
    const { data } = await api.delete(`/usuarios/${id}`);
    return data;
  },

  // ── solicitudes de reingreso (sesión cerrada por accidente) ────────────────────

  /**
   * solicitudesReingreso
   * @returns {Promise<{ solicitudes: object[] }>}
   */
  async solicitudesReingreso() {
    const { data } = await api.get('/usuarios/solicitudes-reingreso');
    return data;
  },

  /**
   * responderReingreso
   * @param {number} id
   * @param {'aprobada'|'rechazada'} estado
   * @returns {Promise<{ solicitud: object }>}
   */
  async responderReingreso(id, estado) {
    const { data } = await api.patch(`/usuarios/solicitudes-reingreso/${id}`, { estado });
    return data;
  },
};