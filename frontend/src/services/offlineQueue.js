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

import { ticketsService } from './ticketsService';

const DB_NAME    = 'tuparley_offline';
const DB_VERSION = 1;
const STORE      = 'tickets_pendientes';

// ─── IndexedDB ───────────────────────────────────────────────────────────────

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

function r4() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

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

async function generarHashTicket({ numero_serie, bodega_id, usuario_id, monto_apostado_usd, cuota_combinada, selecciones, ts }) {
  const seleccionesValidas = serializarSelecciones(selecciones);
  const base = [numero_serie, bodega_id, usuario_id, monto_apostado_usd, cuota_combinada, seleccionesValidas, ts].join('|');
  const encoder    = new TextEncoder();
  const bufferHash = await crypto.subtle.digest('SHA-256', encoder.encode(base));
  return [...new Uint8Array(bufferHash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

async function guardarEnDB(ticket) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(ticket);
    tx.oncomplete = () => resolve(ticket);
    tx.onerror    = () => reject(tx.error);
  });
}

async function leerDeDB(local_id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(local_id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
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
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * agregarTicket — crear ticket offline: genera serie + hash y guarda en cola.
 * @returns {Promise<object>} ticket local completo con `local_id` incluido.
 */
export async function agregarTicket(datosTicket, usuario) {
  const ts           = Date.now();
  const numero_serie = generarNumeroSerieLocal(usuario.bodega_prefijo);
  const local_id     = crypto.randomUUID();

  const base = {
    numero_serie,
    bodega_id:  usuario.bodega_id,
    usuario_id: usuario.id,
    ts,
    ...datosTicket,
  };

  const hash_sha256 = await generarHashTicket(base);

  const ticketLocal = {
    local_id,
    ...base,
    hash_sha256,
    modo_impresion: null,           // se actualiza via actualizarModoOffline()
    origen:         'offline',
    sincronizado:   false,
    fecha_creacion: new Date(ts).toISOString(),
  };

  await guardarEnDB(ticketLocal);
  return ticketLocal;
}

/**
 * actualizarModoOffline — guardar modo_impresion elegido en el ticket de la cola.
 * Llamar DESPUÉS de que el usuario elige física o digital en el ModalImpresion.
 * @param {string} local_id
 * @param {'fisica'|'digital'} modo
 */
export async function actualizarModoOffline(local_id, modo) {
  if (!local_id) return;
  const ticket = await leerDeDB(local_id);
  if (!ticket) return;
  await guardarEnDB({ ...ticket, modo_impresion: modo });
}

/**
 * obtenerPendientes — listar tickets en cola sin sincronizar.
 */
export async function obtenerPendientes() {
  return leerTodosDeDB();
}

/**
 * contarPendientes
 */
export async function contarPendientes() {
  return (await leerTodosDeDB()).length;
}

/**
 * sincronizar — enviar pendientes al backend.
 * Acepta:  { resultados: [{ numero_serie, estado, ticket_id?, motivo? }] }
 * Elimina de cola los que quedaron en estado 'sincronizado' o 'ya_existe'.
 */
export async function sincronizar() {
  const pendientes = await leerTodosDeDB();
  if (pendientes.length === 0) return { aceptados: 0, rechazados: [] };

  // Bug fix: backend espera { cola }, no { tickets }
  const res        = await ticketsService.sincronizarOffline(pendientes);
  const resultados = res.resultados ?? [];

  // Series que el backend procesó correctamente
  const seriesExitosas = new Set(
    resultados
      .filter((r) => r.estado === 'sincronizado' || r.estado === 'ya_existe')
      .map((r) => r.numero_serie),
  );

  // Eliminar de IDB solo los exitosos
  await Promise.all(
    pendientes
      .filter((t) => seriesExitosas.has(t.numero_serie))
      .map((t) => eliminarDeDB(t.local_id)),
  );

  const rechazados = resultados.filter((r) => r.estado === 'rechazado');
  const aceptados  = resultados.filter((r) => r.estado === 'sincronizado').length;

  return { aceptados, rechazados };
}

/**
 * iniciarAutoSync — escuchar reconexión y sincronizar automáticamente.
 * Llamar UNA vez desde App.jsx al montar.
 * @returns {() => void} cleanup
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

  if (navigator.onLine) intentarSync();
  window.addEventListener('online', intentarSync);
  return () => window.removeEventListener('online', intentarSync);
}