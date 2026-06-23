// Archivo: SolicitudAnulacion.jsx
// Ruta: frontend/src/components/ticket/SolicitudAnulacion.jsx
// Función: formulario colapsable para que el bodeguero solicite anular un
//          ticket PENDIENTE (requiere aprobación del admin). Usado dentro de
//          ModalDetalleTicket. Extraído de HistorialPage.jsx (Paso 1).

import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { ticketsService } from '../../services/ticketsService';

export default function SolicitudAnulacion({ ticketId }) {
  const [motivo, setMotivo]     = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado]   = useState(false);
  const [error, setError]       = useState('');
  const [abierto, setAbierto]   = useState(false);

  async function handleSolicitar() {
    if (!motivo.trim()) { setError('Escribe el motivo.'); return; }
    setEnviando(true);
    setError('');
    try {
      await ticketsService.solicitarAnulacion(ticketId, motivo.trim());
      setEnviado(true);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al enviar solicitud.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl p-3 text-xs text-[#10b981]">
        Solicitud de anulación enviada al administrador.
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs text-[#94a3b8] hover:text-white transition"
      >
        <span>Solicitar anulación</span>
        <X className={`w-3.5 h-3.5 transition-transform ${abierto ? '' : 'rotate-45'}`} />
      </button>
      {abierto && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/5">
          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de la anulación…"
            className="w-full bg-[#0f172a] text-white text-xs border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-[#10b981] resize-none mt-2"
          />
          {error && <p className="text-[#ef4444] text-[11px]">{error}</p>}
          <button
            onClick={handleSolicitar}
            disabled={enviando}
            className="w-full bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/30 text-[#ef4444] font-medium text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Enviar al administrador
          </button>
        </div>
      )}
    </div>
  );
}