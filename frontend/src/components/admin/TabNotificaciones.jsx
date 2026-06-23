// Archivo: TabNotificaciones.jsx
// Ruta: frontend/src/components/admin/TabNotificaciones.jsx
// Función: tab del panel admin — feed de alertas en tiempo real (vía socket),
//          marcar leída/todas, eliminar. Extraído de AdminPage.jsx (Paso 4).

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, CheckCircle, X } from 'lucide-react';
import { notificacionesService } from '../../services/notificacionesService';
import { useSocket } from '../../hooks/useSocket';
import { fmtDt } from '../../utils/formatters';

const COLOR_TIPO = {
  usuario_bloqueado:       'border-l-[#ef4444]',
  solicitud_reingreso:     'border-l-[#f59e0b]',
  premio_alto_pagado:      'border-l-[#10b981]',
  ticket_caducado_ganador: 'border-l-[#6b7280]',
  solicitud_anulacion:     'border-l-[#f59e0b]',
  discrepancia_caja:       'border-l-[#ef4444]',
  evento_suspendido:       'border-l-[#f59e0b]',
  api_bcv_caida:           'border-l-[#ef4444]',
  ticket_ganador:          'border-l-[#10b981]',
};

export default function TabNotificaciones({ onContadorChange }) {
  const [notifs, setNotifs]     = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await notificacionesService.listar();
      setNotifs(res.notificaciones ?? []);
      onContadorChange?.(res.notificaciones?.filter((n) => !n.leido).length ?? 0);
    } catch { /* silent */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, []);
  useSocket('notificacion', () => cargar());

  async function marcarLeida(id) {
    await notificacionesService.marcarLeida(id).catch(() => {});
    cargar();
  }

  async function marcarTodas() {
    await notificacionesService.marcarTodas().catch(() => {});
    cargar();
  }

  async function eliminar(id) {
    await notificacionesService.eliminar(id).catch(() => {});
    cargar();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[#94a3b8] text-xs">{notifs.filter((n) => !n.leido).length} sin leer</span>
        <div className="flex gap-2">
          <button onClick={cargar} disabled={cargando}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-white disabled:opacity-40 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={marcarTodas}
            className="text-xs text-[#94a3b8] hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition">
            Marcar todas leídas
          </button>
        </div>
      </div>

      {cargando && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-[#10b981] animate-spin" /></div>}

      {!cargando && notifs.length === 0 && (
        <p className="text-[#475569] text-sm text-center py-8">Sin notificaciones</p>
      )}

      {notifs.map((n) => (
        <div key={n.id}
          className={`bg-[#0f172a] rounded-xl p-4 border-l-4 border border-white/5 flex items-start justify-between gap-3
            ${COLOR_TIPO[n.tipo] ?? 'border-l-[#475569]'}
            ${!n.leido ? '' : 'opacity-50'}`}>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium ${!n.leido ? 'text-white' : 'text-[#94a3b8]'}`}>
              {n.mensaje}
            </p>
            <p className="text-[#475569] text-[11px] mt-1">{fmtDt(n.created_at)}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {!n.leido && (
              <button onClick={() => marcarLeida(n.id)}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 transition">
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => eliminar(n.id)}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 text-[#475569] hover:text-[#ef4444] transition">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}