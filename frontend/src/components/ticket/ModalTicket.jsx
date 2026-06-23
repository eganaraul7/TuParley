// Archivo: ModalTicket.jsx
// Ruta: frontend/src/components/ticket/ModalTicket.jsx
// Función: modal de búsqueda rápida de ticket por número de serie (usado desde
//          la barra superior del Dashboard). Extraído de DashboardPage.jsx
//          (Paso 1 de reorganización components/).

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { ticketsService } from '../../services/ticketsService';
import { fmtUsd, fmtBs, fmtCuota } from '../../utils/formatters';
import { BADGE_ESTADO_TICKET } from '../../utils/constants';

export default function ModalTicket({ serie, onCerrar }) {
  const [ticket, setTicket]     = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (serie) buscar();
  }, [serie]);

  async function buscar() {
    setCargando(true);
    setError('');
    try {
      const res = await ticketsService.buscarPorSerie(serie);
      setTicket(res.ticket);
    } catch {
      setError('Ticket no encontrado.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-[#1e293b] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-white font-semibold">Detalle de Ticket</h3>
          <button onClick={onCerrar} className="text-[#94a3b8] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {cargando && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#10b981] animate-spin" />
            </div>
          )}

          {!cargando && error && (
            <p className="text-[#ef4444] text-sm text-center py-6">{error}</p>
          )}

          {!cargando && ticket && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-xs font-mono">{ticket.numero_serie}</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${BADGE_ESTADO_TICKET[ticket.estado] ?? ''}`}>
                  {ticket.estado}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#0f172a] rounded-xl p-3">
                  <p className="text-[#94a3b8] mb-0.5">Monto apostado</p>
                  <p className="text-white font-bold">{fmtUsd(ticket.monto_apostado_usd)}</p>
                  <p className="text-[#475569]">{fmtBs(ticket.monto_apostado_bs)}</p>
                </div>
                <div className="bg-[#0f172a] rounded-xl p-3">
                  <p className="text-[#94a3b8] mb-0.5">Ganancia potencial</p>
                  <p className="text-[#10b981] font-bold">{fmtUsd(ticket.ganancia_potencial_usd)}</p>
                  <p className="text-[#475569]">{fmtBs(ticket.ganancia_potencial_bs)}</p>
                </div>
              </div>

              {ticket.selecciones?.map((s) => (
                <div key={s.id} className="bg-[#0f172a] rounded-xl p-3 text-xs">
                  <p className="text-white font-medium">{s.evento?.equipo_local} vs {s.evento?.equipo_visitante}</p>
                  <p className="text-[#94a3b8] mt-0.5">{s.modalidad?.nombre} — <span className="text-white">{s.seleccion}</span></p>
                  <p className="text-[#10b981] font-bold mt-0.5">Cuota {fmtCuota(s.cuota_aplicada)}</p>
                </div>
              ))}

              <p className="text-[#475569] text-[11px] text-center">
                Creado: {new Date(ticket.fecha_creacion).toLocaleString('es-VE')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}