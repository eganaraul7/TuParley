import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * api.js — instancia axios central
 *
 * Todo servicio (authService, ticketsService, etc.) importa esta instancia
 * en vez de axios directo, para garantizar headers, baseURL y manejo de
 * errores 401/503 consistentes en toda la app.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── request interceptor: adjuntar JWT ─────────────────────────────────────────
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── response interceptor: manejo global de errores ───────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // 401: token inválido/expirado → forzar logout y volver a login
    // (excepto si la propia request de login/2FA fue la que falló — eso
    // ya lo maneja cada página mostrando el mensaje de error correspondiente)
    if (status === 401) {
      const urlFallida = error.config?.url ?? '';
      const esLoginOTotp = urlFallida.includes('/auth/login');

      if (!esLoginOTotp) {
        useAuthStore.getState().clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // 503: modo mantenimiento activo en backend
    if (status === 503 && error.response?.data?.mantenimiento) {
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export default api;