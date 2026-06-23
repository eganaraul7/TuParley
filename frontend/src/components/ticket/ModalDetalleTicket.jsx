// Archivo: ModalDetalleTicket.jsx
// Ruta: frontend/src/components/ticket/ModalDetalleTicket.jsx
// Función: modal de detalle completo de un ticket desde el Historial — incluye
//          panel de pago de premio (GANADO), aviso de devolución (SUSPENDIDO)
//          y solicitud de anulación (PENDIENTE). Renombrado desde "ModalDetalle"
//          (HistorialPage.jsx) para no chocar con ModalTicket.jsx de Dashboard.
//          Extraído en el Paso 1 de reorganización components/.

import { useState } from 'react';
import { X, DollarSign, Loader2 } from 'lucide-react';
import { fmtUsd, fmtBs, fmtCuota, fmtDt } from '../../utils/formatters';
import { BADGE_ESTADO_TICKET, MAX_GANANCIA_USD } from '../../utils/constants';
import SolicitudAnulacion from './SolicitudAnulacion';

export default function ModalDetalleTicket({ ticket, onCerrar, onPagar }) {
  const [pagando, setPagando]     = useState(false);
  const [cedulaUrl, setCedulaUrl] = useState('');
  const [moneda, setMoneda]       = useState('USD');
  const [errorPago, setErrorPago] = useState('');
  const necesitaCedula = Number(ticket.ganancia_potencial_usd) >= MAX_GANANCIA_USD;

  async function handlePagar() {
    if (necesitaCedula && !cedulaUrl.trim()) {
      setErrorPago(`Se requiere URL de foto de cédula para premios de ${fmtUsd(MAX_GANANCIA_USD)}.`);
      return;
    }
    setPagando(true);
    setErrorPago('');
    try {
      await onPagar(ticket.id, { moneda, cedula_foto_url: cedulaUrl || undefined });
      onCerrar();
    } catch (err) {
      setErrorPago(err.response?.data?.mensaje || 'Error al registrar pago.');
    } finally {
      setPagando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-[#1e293b] rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div>
            <p className="text-white font-bold text-sm font-mono">{ticket.numero_serie}</p>
            <p className="text-[#94a3b8] text-xs">{fmtDt(ticket.fecha_creacion)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${BADGE_ESTADO_TICKET[ticket.estado] ?? ''}`}>
              {ticket.estado}
            </span>
            <button onClick={onCerrar} className="text-[#94a3b8] hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* cuerpo */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {/* montos */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0f172a] rounded-xl p-3">
              <p className="text-[#94a3b8] text-xs mb-1">Apostado</p>
              <p className="text-white font-bold">{fmtUsd(ticket.monto_apostado_usd)}</p>
              <p className="text-[#475569] text-xs">{fmtBs(ticket.monto_apostado_bs)}</p>
            </div>
            <div className="bg-[#0f172a] rounded-xl p-3">
              <p className="text-[#94a3b8] text-xs mb-1">Ganancia potencial</p>
              <p className="text-[#10b981] font-bold">{fmtUsd(ticket.ganancia_potencial_usd)}</p>
              <p className="text-[#475569] text-xs">{fmtBs(ticket.ganancia_potencial_bs)}</p>
            </div>
          </div>

          <div className="bg-[#0f172a] rounded-xl p-3 flex justify-between text-xs">
            <span className="text-[#94a3b8]">Cuota combinada</span>
            <span className="text-white font-bold">{fmtCuota(ticket.cuota_combinada)}</span>
          </div>

          <div className="bg-[#0f172a] rounded-xl p-3 flex justify-between text-xs">
            <span className="text-[#94a3b8]">Tasa BCV del día</span>
            <span className="text-white">Bs {Number(ticket.tasa_bcv_dia).toFixed(2)}</span>
          </div>

          {/* selecciones */}
          {ticket.selecciones?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium">Selecciones</p>
              {ticket.selecciones.map((sel) => (
                <div key={sel.id} className="bg-[#0f172a] rounded-xl p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">
                        {sel.evento?.equipo_local} vs {sel.evento?.equipo_visitante}
                      </p>
                      <p className="text-[#94a3b8] mt-0.5">{sel.modalidad?.nombre}</p>
                      <p className="text-[#94a3b8]">
                        Selección: <span className="text-white">{sel.seleccion}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[#10b981] font-bold">{fmtCuota(sel.cuota_aplicada)}</span>
                      <p className={`mt-1 text-[11px] font-medium ${
                        sel.resultado === 'ganado'    ? 'text-[#10b981]' :
                        sel.resultado === 'perdido'   ? 'text-[#ef4444]' :
                        sel.resultado === 'suspendido'? 'text-[#f59e0b]' :
                        'text-[#475569]'
                      }`}>
                        {sel.resultado.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* pago info si ya fue pagado */}
          {ticket.estado === 'PAGADO' && ticket.pago && (
            <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-xl p-3 text-xs">
              <p className="text-[#3b82f6] font-medium mb-1">Premio entregado</p>
              <p className="text-[#94a3b8]">
                {fmtUsd(ticket.pago.monto_pagado_usd)} en {ticket.pago.moneda} —{' '}
                {fmtDt(ticket.pago.fecha_pago)}
              </p>
            </div>
          )}

          {/* panel pago si GANADO */}
          {ticket.estado === 'GANADO' && (
            <div className="bg-[#10b981]/5 border border-[#10b981]/20 rounded-xl p-4 space-y-3">
              <p className="text-[#10b981] text-xs font-bold uppercase tracking-wider">Registrar Pago</p>

              {/* moneda */}
              <div className="flex gap-2">
                {['USD', 'BS'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMoneda(m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition
                      ${moneda === m
                        ? 'bg-[#10b981] border-[#10b981] text-white'
                        : 'bg-[#0f172a] border-white/10 text-[#94a3b8] hover:text-white'}`}
                  >
                    {m === 'USD' ? '$ Dólares' : 'Bs Bolívares'}
                  </button>
                ))}
              </div>

              {/* cédula si necesario */}
              {necesitaCedula && (
                <div>
                  <label className="text-[#94a3b8] text-[11px] uppercase tracking-wider font-medium block mb-1">
                    URL Foto Cédula <span className="text-[#ef4444]">*</span>
                  </label>
                  <input
                    type="text"
                    value={cedulaUrl}
                    onChange={(e) => setCedulaUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full bg-[#0f172a] text-white text-xs border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#10b981]"
                  />
                  <p className="text-[#f59e0b] text-[11px] mt-1">
                    Premio de {fmtUsd(MAX_GANANCIA_USD)} — foto de cédula obligatoria.
                  </p>
                </div>
              )}

              {errorPago && (
                <p className="text-[#ef4444] text-xs">{errorPago}</p>
              )}

              <button
                onClick={handlePagar}
                disabled={pagando}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                {pagando
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando…</>
                  : <><DollarSign className="w-4 h-4" />Confirmar pago</>}
              </button>
            </div>
          )}

          {/* suspendido: devolución */}
          {ticket.estado === 'SUSPENDIDO' && (
            <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl p-3 text-xs">
              <p className="text-[#f59e0b] font-medium">Evento suspendido</p>
              <p className="text-[#94a3b8] mt-0.5">
                El cliente puede solicitar devolución de {fmtUsd(ticket.monto_apostado_usd)}{' '}
                en la moneda original ({ticket.moneda_pago}).
              </p>
            </div>
          )}

          {/* anulación */}
          {ticket.estado === 'PENDIENTE' && (
            <SolicitudAnulacion ticketId={ticket.id} />
          )}
        </div>
      </div>
    </div>
  );
}