import { create } from 'zustand';

/**
 * bcvStore — tasa BCV en tiempo real
 *
 * NO persiste en localStorage: la tasa se obtiene del servidor al conectar
 * y se actualiza vía WebSocket ('bcv_actualizada').
 * Se inicializa desde GET /api/bcv/actual al montar la app.
 */
export const useBcvStore = create((set, get) => ({
  // ── state ────────────────────────────────────────────────────────────────
  tasaBcv:       null,   // number | null — Bs por $1 USD
  fuente:        null,   // 'api' | 'manual'
  fechaTasa:     null,   // ISO date string
  cargando:      false,
  error:         false,

  // ── actions ──────────────────────────────────────────────────────────────

  /**
   * setTasaBcv — actualizar tasa (vía socket o carga inicial)
   * @param {number|string} valor  Tasa en Bs/$
   * @param {'api'|'manual'} fuente
   * @param {string} fecha  Fecha ISO de la tasa
   */
  setTasaBcv: (valor, fuente = 'api', fecha = null) =>
    set({
      tasaBcv:   Number(valor),
      fuente,
      fechaTasa: fecha ?? new Date().toISOString(),
      error:     false,
    }),

  /**
   * setError — marcar que la API BCV falló
   */
  setError: () => set({ error: true }),

  /**
   * setCargando
   */
  setCargando: (val) => set({ cargando: val }),

  // ── selectors ─────────────────────────────────────────────────────────────

  /**
   * convertirUsdABs — convierte monto USD a Bs usando la tasa actual
   * @param {number} montoUsd
   * @returns {number}
   */
  convertirUsdABs: (montoUsd) => {
    const { tasaBcv } = get();
    if (!tasaBcv || !montoUsd) return 0;
    return Number((montoUsd * tasaBcv).toFixed(2));
  },

  /**
   * convertirBsAUsd — convierte monto Bs a USD usando la tasa actual
   * @param {number} montoBs
   * @returns {number}
   */
  convertirBsAUsd: (montoBs) => {
    const { tasaBcv } = get();
    if (!tasaBcv || !montoBs) return 0;
    return Number((montoBs / tasaBcv).toFixed(2));
  },
}));