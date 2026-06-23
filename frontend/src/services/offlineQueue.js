import { ticketsService } from './ticketsService';

/**
 * offlineQueue.js — cola local de tickets creados sin conexión
 *
 * Flujo:
 *   1. Sin internet → agregarTicket() genera numero_serie + hash localmente,
 *      guarda en IndexedDB, retorna el ticket para imprimir de inmediato.
 *   2. Vuelve la conexión → evento 'online' dispara sincronizar() automático.
 *   3. Backend verifica cada hash_sha256 → acepta o rechaza por ticket.
 *      Los aceptados se borran de la cola; los rechazados quedan para revisión.
 *
 * ⚠️ CONTRATO DE HASH — debe ser IDÉNTICO en backend (services/hash.js):
 *   Concatenar con '|' en este orden exacto:
 *     numero_serie | bodega_id | usuario_id | monto_apostado_usd |
 *     cuota_combinada | seleccionesValidas | ts
 *   donde seleccionesValidas = JSON.stringify(
 *     selecciones
 *       .map(s => ({ evento_id: s.evento_id, modalidad_id: s.modalidad_id, cuota_aplicada: s.cuota_aplicada }))
 *       .sort((a, b) => a.evento_id - b.evento_id)
 *   )
 *   Luego SHA-256 hex del string resultante.
 */

const DB_NAME    = 'tuparley_offline';
const DB_VERSION = 1;
const STORE      = 'tickets_pendientes';

// ─── IndexedDB: apertura/migración ─────────────────────────────────────────────
function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'local_id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ─── helpers internos ───────────────────────────────────────────────────────────
function r4() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * generarNumeroSerieLocal — mismo formato que el backend genera online
 * @param {string} prefijoBodega  ej. 'B1'
 */
function generarNumeroSerieLocal(prefijoBodega) {
  return `${prefijoBodega}-${r4()}-${r4()}`;
}

function serializarSelecciones(selecciones) {
  return JSON.stringify(
    [...selecciones]
      .map((s) => ({
        evento_id:      s.evento_id,
        modalidad_id:   s.modalidad_id,
        cuota_aplicada: s.cuota_aplicada,
      }))
      .sort((a, b) => a.evento_id - b.evento_id),
  );
}

/**
 * generarHashTicket — SHA-256 vía Web Crypto API (requiere contexto seguro: HTTPS/localhost)
 */
async function generarHashTicket({ numero_serie, bodega_id, usuario_id, monto_apostado_usd, cuota_combinada, selecciones, ts }) {
  const seleccionesValidas = serializarSelecciones(selecciones);
  const base = [numero_serie, bodega_id, usuario_id, monto_apostado_usd, cuota_combinada, seleccionesValidas, ts].join('|');

  const encoder    = new TextEncoder();
  const bufferHash = await crypto.subtle.digest('SHA-256', encoder.encode(base));

  return [...new Uint8Array(bufferHash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── operaciones IndexedDB ───────────────────────────────────────────────────────
async function guardarEnDB(ticket) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(ticket);
    tx.oncomplete = () => resolve(ticket);
    tx.onerror    = () => reject(tx.error);
  });
}

async function eliminarDeDB(local_id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(local_id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function leerTodosDeDB() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * agregarTicket — crear ticket offline: genera serie + hash y lo guarda en cola
 *
 * @param {object} datosTicket  Mismo shape que ticketsService.crear():
 *   { selecciones, monto_apostado_usd, monto_apostado_bs, tasa_bcv_dia,
 *     cuota_combinada, ganancia_potencial_usd, ganancia_potencial_bs, moneda_pago }
 * @param {object} usuario  JWT payload activo: { id, bodega_id, bodega_prefijo }
 * @returns {Promise<object>}  Ticket local completo, listo para imprimir
 */
export async function agregarTicket(datosTicket, usuario) {
  const ts            = Date.now();
  const numero_serie  = generarNumeroSerieLocal(usuario.bodega_prefijo);
  const local_id      = crypto.randomUUID();

  const base = {
    numero_serie,
    bodega_id:   usuario.bodega_id,
    usuario_id:  usuario.id,
    ts,
    ...datosTicket,
  };

  const hash_sha256 = await generarHashTicket(base);

  const ticketLocal = {
    local_id,
    ...base,
    hash_sha256,
    origen:        'offline',
    sincronizado:  false,
    fecha_creacion: new Date(ts).toISOString(),
  };

  await guardarEnDB(ticketLocal);
  return ticketLocal;
}

/**
 * obtenerPendientes — listar tickets en cola sin sincronizar
 * @returns {Promise<object[]>}
 */
export async function obtenerPendientes() {
  return leerTodosDeDB();
}

/**
 * contarPendientes
 * @returns {Promise<number>}
 */
export async function contarPendientes() {
  const pendientes = await leerTodosDeDB();
  return pendientes.length;
}

/**
 * sincronizar — enviar todos los pendientes al backend
 * Tickets aceptados se eliminan de la cola; rechazados quedan para revisión manual.
 *
 * @returns {Promise<{ aceptados: number, rechazados: object[] }>}
 */
export async function sincronizar() {
  const pendientes = await leerTodosDeDB();
  if (pendientes.length === 0) {
    return { aceptados: 0, rechazados: [] };
  }

  const res = await ticketsService.sincronizarOffline(pendientes);
  const rechazadosIds = new Set((res.rechazados ?? []).map((r) => r.local_id));

  await Promise.all(
    pendientes
      .filter((t) => !rechazadosIds.has(t.local_id))
      .map((t) => eliminarDeDB(t.local_id)),
  );

  return res;
}

/**
 * iniciarAutoSync — escuchar reconexión y sincronizar automáticamente
 * Llamar UNA vez desde App.jsx al montar la aplicación.
 *
 * @returns {() => void} función de limpieza (remover listener)
 */
export function iniciarAutoSync() {
  async function intentarSync() {
    try {
      const res = await sincronizar();
      if (res.aceptados > 0) {
        console.log(`[offlineQueue] ${res.aceptados} ticket(s) sincronizado(s)`);
      }
    } catch (err) {
      console.error('[offlineQueue] error al sincronizar:', err.message);
    }
  }

  // intentar de inmediato si ya hay conexión al cargar (cola de sesión previa)
  if (navigator.onLine) intentarSync();

  window.addEventListener('online', intentarSync);
  return () => window.removeEventListener('online', intentarSync);
}