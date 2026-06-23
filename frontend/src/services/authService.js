import api from './api';

/**
 * authService — autenticación y gestión de 2FA
 *
 * ⚠️ NOTA DE ARQUITECTURA — dos flujos 2FA distintos, no confundir:
 *
 *  1) DESAFÍO DE LOGIN (login() → verify2fa()):
 *     Usuario sin sesión aún. login() detecta totp_habilitado=1 y devuelve
 *     un temp_token de corta duración (~5 min). verify2fa() lo intercambia
 *     por el JWT completo. Endpoint: POST /auth/login/verify-2fa
 *     (no requiere Authorization header — el temp_token va en el body).
 *
 *  2) ENROLLMENT DE 2FA (setup2fa() → confirmarSetup2fa()):
 *     Admin YA logueado configurando 2FA por primera vez (genera QR/secret
 *     y confirma con un código antes de habilitarlo). Endpoints:
 *     POST /auth/setup-2fa y POST /auth/verify-2fa (ambos con sesión activa).
 */
export const authService = {
  // ── login ──────────────────────────────────────────────────────────────────

  /**
   * login — paso 1: credenciales
   * @param {{ nombre_usuario: string, contrasena: string }} payload
   * @returns {Promise<{ requiere2fa: boolean, temp_token?: string, token?: string, usuario?: object }>}
   */
  async login({ nombre_usuario, contrasena }) {
    const { data } = await api.post('/auth/login', { nombre_usuario, contrasena });
    return data;
  },

  /**
   * verify2fa — paso 2 del LOGIN (desafío TOTP, no enrollment)
   * @param {{ temp_token: string, codigo_totp: string }} payload
   * @returns {Promise<{ token: string, usuario: object }>}
   */
  async verify2fa({ temp_token, codigo_totp }) {
    const { data } = await api.post('/auth/login/verify-2fa', { temp_token, codigo_totp });
    return data;
  },

  /**
   * me — obtener usuario actual desde el token activo
   * @returns {Promise<{ usuario: object }>}
   */
  async me() {
    const { data } = await api.get('/auth/me');
    return data;
  },

  /**
   * logout — invalidar sesión en backend (best-effort)
   */
  async logout() {
    const { data } = await api.post('/auth/logout');
    return data;
  },

  // ── 2FA enrollment (admin ya logueado) ───────────────────────────────────────

  /**
   * setup2fa — generar secret + QR para habilitar 2FA por primera vez
   * @returns {Promise<{ qr_url: string, secret: string }>}
   */
  async setup2fa() {
    const { data } = await api.post('/auth/setup-2fa');
    return data;
  },

  /**
   * confirmarSetup2fa — confirmar el código generado por el QR y habilitar 2FA
   * @param {{ codigo_totp: string }} payload
   */
  async confirmarSetup2fa({ codigo_totp }) {
    const { data } = await api.post('/auth/verify-2fa', { codigo_totp });
    return data;
  },

  // ── contraseña ────────────────────────────────────────────────────────────────

  /**
   * cambiarContrasena — usuario autenticado cambia su propia contraseña
   * @param {{ actual: string, nueva: string }} payload
   */
  async cambiarContrasena({ actual, nueva }) {
    const { data } = await api.post('/auth/cambiar-contrasena', {
      contrasena_actual: actual,
      contrasena_nueva:  nueva,
    });
    return data;
  },
};