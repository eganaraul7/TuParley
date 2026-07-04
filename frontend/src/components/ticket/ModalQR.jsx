// Nombre de archivo: ModalQR.jsx
// Ruta: frontend/src/components/ticket/ModalQR.jsx
// Función: Modal dual — pestaña "Mostrar QR" para el cliente y pestaña
//          "Verificar" para que el bodeguero/admin consulte estado de un ticket.

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Search, Loader2, CheckCircle, XCircle, Clock,
          AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ticketsService } from '../../services/ticketsService';
import { fmtUsd, fmtBs } from '../../utils/formatters';

// ── Colores de estado ─────────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  PENDIENTE:         { label: 'Pendiente',         color: '#f59e0b', Icon: Clock },
  GANADO:            { label: 'Ganado',             color: '#10b981', Icon: CheckCircle },
  PERDIDO:           { label: 'Perdido',            color: '#ef4444', Icon: XCircle },
  PAGADO:            { label: 'Pagado',             color: '#6366f1', Icon: CheckCircle },
  ANULADO:           { label: 'Anulado',            color: '#64748b', Icon: XCircle },
  SUSPENDIDO:        { label: 'Suspendido',         color: '#f97316', Icon: AlertTriangle },
  CADUCADO_GANADOR:  { label: 'No cobrado',         color: '#94a3b8', Icon: AlertTriangle },
};

// ── Sub-componente: resultado de verificación ─────────────────────────────────
function ResultadoTicket({ datos }) {
  const estadoCfg = ESTADO_CONFIG[datos.estado] ?? { label: datos.estado, color: '#94a3b8', Icon: Clock };
  const { Icon } = estadoCfg;

  return (
    <div className="space-y-3 mt-4">
      {/* Estado + hash */}
      <div className="flex items-center justify-between bg-[#0f172a] rounded-xl p-3.5 border border-white/5">
        <div className="flex items-center gap-2.5">
          <Icon className="w-5 h-5" style={{ color: estadoCfg.color }} />
          <div>
            <p className="text-white font-bold text-sm">{estadoCfg.label}</p>
            <p className="text-[#475569] text-[11px]">{datos.serie}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {datos.hash_valido
            ? <><ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" /><span className="text-[#10b981]">Firmado</span></>
            : <><ShieldAlert className="w-3.5 h-3.5 text-[#ef4444]" /><span className="text-[#ef4444]">Sin firma</span></>}
        </div>
      </div>

      {/* Montos */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#0f172a] rounded-xl p-3 border border-white/5">
          <p className="text-[#475569] text-[10px] uppercase tracking-wider mb-1">Apostado</p>
          <p className="text-white font-bold text-sm">{fmtUsd(datos.monto_apostado_usd)}</p>
          <p className="text-[#334155] text-[11px]">{fmtBs(datos.monto_apostado_bs)}</p>
        </div>
        <div className={`rounded-xl p-3 border ${datos.estado === 'GANADO' || datos.estado === 'PAGADO'
          ? 'bg-[#10b981]/8 border-[#10b981]/20'
          : 'bg-[#0f172a] border-white/5'}`}>
          <p className="text-[#475569] text-[10px] uppercase tracking-wider mb-1">Ganancia potencial</p>
          <p className={`font-bold text-sm ${datos.estado === 'GANADO' || datos.estado === 'PAGADO'
            ? 'text-[#10b981]' : 'text-white'}`}>
            {fmtUsd(datos.ganancia_potencial_usd)}
          </p>
          <p className="text-[#334155] text-[11px]">{fmtBs(datos.ganancia_potencial_bs)}</p>
        </div>
      </div>

      {/* Cuota + bodega */}
      <div className="flex justify-between text-xs px-1">
        <span className="text-[#475569]">Cuota combinada <span className="text-white font-bold">{datos.cuota_combinada}×</span></span>
        <span className="text-[#475569]">{datos.bodega_nombre}</span>
      </div>

      {/* Selecciones */}
      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
        {datos.selecciones.map((s, i) => (
          <div key={i} className="bg-[#0f172a] rounded-lg px-3 py-2 border border-white/5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">{s.equipos}</p>
              <p className="text-[#475569] text-[10px]">{s.modalidad} · {s.seleccion}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[#10b981] text-xs font-black">{s.cuota}×</span>
              {s.resultado !== 'pendiente' && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                  ${s.resultado === 'ganado' ? 'bg-[#10b981]/15 text-[#10b981]'
                    : s.resultado === 'perdido' ? 'bg-[#ef4444]/15 text-[#ef4444]'
                    : 'bg-white/8 text-[#94a3b8]'}`}>
                  {s.resultado}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export default function ModalQR({ ticket, onClose }) {
  const [tab,        setTab]        = useState('mostrar');
  const [serie,      setSerie]      = useState('');
  const [resultado,  setResultado]  = useState(null);
  const [buscando,   setBuscando]   = useState(false);
  const [errorBusq,  setErrorBusq]  = useState('');

  async function handleVerificar(e) {
    e.preventDefault();
    const s = serie.trim().toUpperCase();
    if (!s) return;
    setBuscando(true);
    setResultado(null);
    setErrorBusq('');
    try {
      const data = await ticketsService.consultarQR(s);
      setResultado(data);
    } catch (err) {
      setErrorBusq(err.response?.data?.error ?? 'Ticket no encontrado');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-white/10 rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-white font-bold text-base">Ticket Digital</h2>
          <button onClick={onClose} className="text-[#475569] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-white/5">
          {[
            { key: 'mostrar',    label: 'Mostrar QR' },
            { key: 'verificar',  label: 'Verificar Ticket' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setResultado(null); setErrorBusq(''); setSerie(''); }}
              className={`flex-1 py-3 text-sm font-semibold transition border-b-2
                ${tab === key
                  ? 'text-[#10b981] border-[#10b981]'
                  : 'text-[#475569] border-transparent hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── Pestaña: Mostrar QR ──────────────────────────────── */}
          {tab === 'mostrar' && ticket && (
            <div className="flex flex-col items-center gap-4">

              {/* QR */}
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <QRCodeSVG
                  value={ticket.numero_serie}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Serie */}
              <div className="text-center">
                <p className="text-[#475569] text-xs mb-1">Número de serie</p>
                <p className="text-white font-black text-lg tracking-widest">{ticket.numero_serie}</p>
              </div>

              {/* Detalles compactos */}
              <div className="w-full grid grid-cols-2 gap-2">
                <div className="bg-[#0f172a] rounded-xl p-3 border border-white/5 text-center">
                  <p className="text-[#475569] text-[10px] uppercase tracking-wider mb-1">Apostado</p>
                  <p className="text-white font-bold text-sm">{fmtUsd(ticket.monto_apostado_usd)}</p>
                </div>
                <div className="bg-[#10b981]/8 border border-[#10b981]/20 rounded-xl p-3 text-center">
                  <p className="text-[#475569] text-[10px] uppercase tracking-wider mb-1">Ganancia potencial</p>
                  <p className="text-[#10b981] font-bold text-sm">{fmtUsd(ticket.ganancia_potencial_usd)}</p>
                </div>
              </div>

              <p className="text-[#334155] text-xs text-center leading-relaxed">
                El cliente fotografía el código QR.<br />
                Se verifica en la pestaña "Verificar Ticket".
              </p>
            </div>
          )}

          {/* ── Pestaña: Verificar ───────────────────────────────── */}
          {tab === 'verificar' && (
            <div>
              <form onSubmit={handleVerificar} className="flex gap-2">
                <input
                  type="text"
                  value={serie}
                  onChange={(e) => setSerie(e.target.value.toUpperCase())}
                  placeholder="Ej. B1-1234-5678"
                  className="flex-1 bg-[#0f172a] text-white placeholder-[#334155] text-sm border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#10b981] transition font-mono"
                />
                <button
                  type="submit"
                  disabled={buscando || !serie.trim()}
                  className="bg-[#10b981] hover:bg-[#059669] disabled:opacity-40 text-white rounded-xl px-4 py-3 transition flex items-center gap-1.5"
                >
                  {buscando
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Search className="w-4 h-4" />}
                </button>
              </form>

              {errorBusq && (
                <div className="mt-3 flex items-center gap-2 text-[#ef4444] text-sm bg-[#ef4444]/8 border border-[#ef4444]/20 rounded-xl p-3">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {errorBusq}
                </div>
              )}

              {resultado && <ResultadoTicket datos={resultado} />}

              {!resultado && !buscando && !errorBusq && (
                <p className="text-[#334155] text-xs text-center mt-6">
                  Ingresa el número de serie para consultar el estado del ticket
                </p>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-white/8 text-[#475569] hover:text-white text-sm font-semibold transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}