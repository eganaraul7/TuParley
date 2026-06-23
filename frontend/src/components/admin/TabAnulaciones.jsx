// Archivo: TabAnulaciones.jsx
// Ruta: frontend/src/components/admin/TabAnulaciones.jsx
// Función: tab del panel admin — cola de solicitudes de anulación de tickets
//          (aprobar/rechazar) + historial de resueltas. Extraído de
//          AdminPage.jsx (Paso 4 de reorganización components/).

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { ticketsService } from '../../services/ticketsService';
import { fmtUsd, fmtDt } from '../../utils/formatters';

export default function TabAnulaciones() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando]       = useState(false);
  const [error, setError]             = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const res = await ticketsService.listarAnulaciones();
      setSolicitudes(res.solicitudes ?? []);
    } catch { setError('Error cargando solicitudes.'); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, []);

  async function responder(id, aprobar) {
    try {
      await ticketsService.responderAnulacion(id, aprobar ? 'aprobada' : 'rechazada');
      cargar();
    } catch { setError('Error al procesar.'); }
  }

  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente');
  const resueltas  = solicitudes.filter((s) => s.estado !== 'pendiente');

  return (
    <div className="space-y-4">
      {error && <p className="text-[#ef4444] text-xs">{error}</p>}
      <div className="flex items-center justify-between">
        <span className="text-[#94a3b8] text-xs">{pendientes.length} pendiente(s)</span>
        <button onClick={cargar} disabled={cargando}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-white disabled:opacity-40 transition">
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {cargando && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#10b981] animate-spin" /></div>}

      {!cargando && pendientes.length === 0 && (
        <p className="text-[#475569] text-sm text-center py-8">Sin solicitudes pendientes</p>
      )}

      {pendientes.map((s) => (
        <div key={s.id} className="bg-[#0f172a] rounded-xl p-4 border border-[#f59e0b]/20 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-white text-sm font-bold font-mono">{s.ticket?.numero_serie}</p>
              <p className="text-[#94a3b8] text-xs mt-0.5">
                Solicitado por <span className="text-white">{s.solicitado_por_usuario?.nombre_usuario}</span>
                {' · '}{fmtDt(s.created_at)}
              </p>
              <p className="text-[#94a3b8] text-xs mt-1">Monto: <span className="text-white">{fmtUsd(s.ticket?.monto_apostado_usd)}</span></p>
            </div>
            <span className="text-[#f59e0b] text-xs font-bold border border-[#f59e0b]/30 bg-[#f59e0b]/10 rounded-full px-2.5 py-1">
              PENDIENTE
            </span>
          </div>
          {s.motivo && (
            <p className="text-[#94a3b8] text-xs bg-[#1e293b] rounded-lg px-3 py-2">
              <span className="text-[#475569]">Motivo:</span> {s.motivo}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => responder(s.id, true)}
              className="flex-1 py-2.5 bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] rounded-xl text-xs font-bold hover:bg-[#10b981]/20 transition">
              ✓ Aprobar anulación
            </button>
            <button onClick={() => responder(s.id, false)}
              className="flex-1 py-2.5 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-xl text-xs font-bold hover:bg-[#ef4444]/20 transition">
              ✗ Rechazar
            </button>
          </div>
        </div>
      ))}

      {resueltas.length > 0 && (
        <div className="mt-4">
          <p className="text-[#475569] text-xs uppercase tracking-wider mb-2">Resueltas</p>
          {resueltas.slice(0, 10).map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/5 text-xs">
              <span className="text-[#94a3b8] font-mono">{s.ticket?.numero_serie}</span>
              <span className={`font-bold ${s.estado === 'aprobada' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {s.estado.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}