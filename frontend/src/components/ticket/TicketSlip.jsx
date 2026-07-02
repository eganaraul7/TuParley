// Nombre de archivo: TicketSlip.jsx
// Ruta: frontend/src/components/ticket/TicketSlip.jsx
// Función: Panel derecho — ticket parlay en construcción. Muestra selecciones,
//          calcula ganancia en tiempo real y dispara onImprimir con botón grande.

import { useMemo } from 'react';
import { X, Trash2, AlertTriangle, Loader2, Printer } from 'lucide-react';
import { fmtUsd, fmtBs, fmtCuota } from '../../utils/formatters';
import { MAX_GANANCIA_USD, APUESTA_MINIMA_USD } from '../../utils/constants';

export default function TicketSlip({
  selecciones,
  tasaBcv,
  montoUsd,
  onCambiarMonto,
  onRemoverSeleccion,
  onLimpiar,
  onImprimir,
  imprimiendo,
}) {
  const cuotaCombinada = useMemo(
    () => selecciones.reduce((acc, s) => acc * Number(s.cuota_aplicada), 1),
    [selecciones],
  );

  const gananciaPotencialUsd = useMemo(
    () => (montoUsd > 0 ? montoUsd * cuotaCombinada : 0),
    [montoUsd, cuotaCombinada],
  );

  const gananciaPotencialBs = useMemo(
    () => (tasaBcv ? gananciaPotencialUsd * Number(tasaBcv) : 0),
    [gananciaPotencialUsd, tasaBcv],
  );

  const montoEnBs = useMemo(
    () => (tasaBcv && montoUsd > 0 ? montoUsd * Number(tasaBcv) : 0),
    [montoUsd, tasaBcv],
  );

  const limiteAlcanzado      = gananciaPotencialUsd >= MAX_GANANCIA_USD;
  const montoValido          = montoUsd >= APUESTA_MINIMA_USD;
  const puedeImprimir        = selecciones.length > 0 && montoValido;
  const mostrarAlertaLimite  = limiteAlcanzado && selecciones.length > 0;

  function handleMontoChange(e) {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const val = parseFloat(raw);
    if (isNaN(val)) { onCambiarMonto(0); return; }
    if (cuotaCombinada > 0) {
      const maxMonto = MAX_GANANCIA_USD / cuotaCombinada;
      onCambiarMonto(Math.min(val, maxMonto));
    } else {
      onCambiarMonto(val);
    }
  }

  return (
    <aside className="w-[30%] min-w-[270px] bg-[#1e293b] border-l border-white/5 flex flex-col">

      {/* ── Cabecera ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 shrink-0">
        <div>
          <h2 className="text-white text-sm font-bold">Ticket Parlay</h2>
          <span className="text-[#475569] text-xs">
            {selecciones.length === 0
              ? 'Sin selecciones'
              : `${selecciones.length} selección${selecciones.length !== 1 ? 'es' : ''}`}
          </span>
        </div>
        {selecciones.length > 0 && (
          <button
            onClick={onLimpiar}
            className="flex items-center gap-1 text-[#475569] hover:text-[#ef4444] text-xs transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* ── Lista de selecciones ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {selecciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
            <span className="text-4xl opacity-20">🎫</span>
            <p className="text-[#334155] text-xs leading-relaxed">
              Selecciona una cuota<br />para iniciar tu parlay
            </p>
          </div>
        ) : (
          selecciones.map((sel) => (
            <div
              key={`${sel.evento_id}-${sel.modalidad_id}`}
              className="bg-[#0f172a] rounded-xl p-3 border border-white/5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-xs font-semibold truncate">{sel.equipos}</p>
                  <p className="text-[#475569] text-[11px] mt-0.5 truncate">{sel.modalidad_nombre}</p>
                  <p className="text-[#94a3b8] text-[11px]">{sel.seleccion}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[#10b981] text-base font-black">{fmtCuota(sel.cuota_aplicada)}</span>
                  <button
                    onClick={() => onRemoverSeleccion(sel.evento_id)}
                    className="text-[#334155] hover:text-[#ef4444] transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Alerta límite */}
        {mostrarAlertaLimite && (
          <div className="flex items-start gap-2 bg-[#ef4444]/8 border border-[#ef4444]/25 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
            <p className="text-[#ef4444] text-[11px] leading-tight">
              Límite de {fmtUsd(MAX_GANANCIA_USD)} alcanzado. No puedes agregar más eventos.
            </p>
          </div>
        )}
      </div>

      {/* ── Panel inferior ────────────────────────────────────── */}
      <div className="border-t border-white/5 p-3.5 space-y-3 shrink-0">

        {/* Cuota combinada */}
        {selecciones.length > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[#475569] text-xs">Cuota combinada</span>
            <span className="text-white font-black text-sm">{fmtCuota(cuotaCombinada)}×</span>
          </div>
        )}

        {/* Monto */}
        <div>
          <label className="text-[#475569] text-[11px] uppercase tracking-wider font-semibold block mb-1.5">
            Monto a apostar
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm font-bold">$</span>
            <input
              type="number"
              min={APUESTA_MINIMA_USD}
              step="0.50"
              value={montoUsd || ''}
              onChange={handleMontoChange}
              placeholder="0.00"
              className="w-full bg-[#0f172a] text-white text-right font-black text-xl border border-white/10 rounded-xl pl-8 pr-4 py-3.5 focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/40 transition"
            />
          </div>
          {montoEnBs > 0 && (
            <p className="text-[#334155] text-[11px] mt-1.5 text-right">
              ≈ {fmtBs(montoEnBs)}
            </p>
          )}
          {montoUsd > 0 && montoUsd < APUESTA_MINIMA_USD && (
            <p className="text-[#ef4444] text-[11px] mt-1">
              Mínimo {fmtUsd(APUESTA_MINIMA_USD)}
            </p>
          )}
        </div>

        {/* Ganancia potencial */}
        {selecciones.length > 0 && montoValido && (
          <div className={`rounded-xl p-3.5 border transition-all
            ${limiteAlcanzado
              ? 'bg-[#ef4444]/8 border-[#ef4444]/25'
              : 'bg-[#10b981]/8 border-[#10b981]/20'}`}
          >
            <p className="text-[#475569] text-[11px] uppercase tracking-wider font-semibold mb-1">
              Ganancia potencial
            </p>
            <p className={`text-3xl font-black tracking-tight
              ${limiteAlcanzado ? 'text-[#ef4444]' : 'text-[#10b981]'}`}
            >
              {fmtUsd(Math.min(gananciaPotencialUsd, MAX_GANANCIA_USD))}
            </p>
            {gananciaPotencialBs > 0 && (
              <p className="text-[#475569] text-xs mt-0.5">
                ≈ {fmtBs(Math.min(gananciaPotencialBs, MAX_GANANCIA_USD * Number(tasaBcv)))}
              </p>
            )}
          </div>
        )}

        {/* Botón principal */}
        <button
          onClick={onImprimir}
          disabled={!puedeImprimir || imprimiendo}
          className={`
            w-full flex items-center justify-center gap-2.5
            py-4 rounded-xl font-black text-base transition-all duration-150
            ${puedeImprimir && !imprimiendo
              ? 'bg-[#10b981] hover:bg-[#059669] active:scale-[0.98] text-white shadow-[0_4px_20px_rgba(16,185,129,0.30)]'
              : 'bg-[#0f172a] border border-white/8 text-[#2d3748] cursor-not-allowed'}
          `}
        >
          {imprimiendo
            ? <><Loader2 className="w-5 h-5 animate-spin" />Procesando…</>
            : <><Printer className="w-5 h-5" />Guardar e Imprimir</>}
        </button>

        {selecciones.length > 0 && !montoValido && (
          <p className="text-[#334155] text-[11px] text-center">
            Mínimo {fmtUsd(APUESTA_MINIMA_USD)} para continuar
          </p>
        )}
      </div>
    </aside>
  );
}