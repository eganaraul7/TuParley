import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * authStore — estado de autenticación global
 *
 * Persiste en localStorage para sobrevivir recargas de página.
 * JWT payload esperado del backend:
 *   { id, nombre_usuario, rol, bodega_id, bodega_nombre, bodega_prefijo, hora_apertura_sesion }
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── state ──────────────────────────────────────────────────────────────
      token:      null,
      usuario:    null,
      isLoggedIn: false,

      // ── actions ────────────────────────────────────────────────────────────

      /**
       * setAuth — llamar tras login exitoso (credenciales o 2FA)
       * @param {string} token  JWT recibido del backend
       * @param {object} usuario  Payload del usuario { id, nombre_usuario, rol, ... }
       */
      setAuth: (token, usuario) =>
        set({ token, usuario, isLoggedIn: true }),

      /**
       * clearAuth — limpiar sesión completa (logout / cierre de caja / bloqueo)
       */
      clearAuth: () =>
        set({ token: null, usuario: null, isLoggedIn: false }),

      /**
       * updateUsuario — actualizar parcialmente los datos del usuario
       * Útil cuando el admin cambia el rol del propio usuario en sesión
       * @param {Partial<object>} cambios
       */
      updateUsuario: (cambios) =>
        set((state) => ({
          usuario: state.usuario ? { ...state.usuario, ...cambios } : null,
        })),

      // ── selectors (helpers) ───────────────────────────────────────────────

      /** true si el usuario es computadora_madre o administrador */
      esAdmin: () => {
        const { usuario } = get();
        return (
          usuario?.rol === 'computadora_madre' ||
          usuario?.rol === 'administrador'
        );
      },

      /** true si el usuario es bodeguero */
      esBodeguero: () => get().usuario?.rol === 'bodeguero',

      /** true si el usuario es desconocido */
      esDesconocido: () => get().usuario?.rol === 'desconocido',
    }),
    {
      name:    'tuparley_auth',           // clave en localStorage
      storage: createJSONStorage(() => localStorage),
      // Solo persistir token y usuario — isLoggedIn se deriva
      partialize: (state) => ({
        token:   state.token,
        usuario: state.usuario,
        // isLoggedIn se recalcula al rehidratar
      }),
      // Al rehidratar, recalcular isLoggedIn
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoggedIn = !!state.token && !!state.usuario;
        }
      },
    },
  ),
);