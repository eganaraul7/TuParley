// Nombre de archivo: TarjetaEvento.jsx
// Ruta: frontend/src/components/bodeguero/TarjetaEvento.jsx
// Función: Tarjeta visual de un evento deportivo con cuotas táctiles optimizadas
//          para tablet. Borde verde al tener selección activa en este evento.

import { fmtHora, fmtFecha } from '../../utils/formatters';
import { COLORES_ESTADO_EVENTO } from '../../utils/constants';
import BtnCuota from '../ticket/BtnCuota';

export default function TarjetaEvento({
  evento,
  modalidades,
  seleccionesActivas,
  limiteAlcanzado,
  onSeleccionar,
}) {
  const seleccionadosEnEsteEvento = seleccionesActivas
    .filter((s) => s.evento_id === evento.id)
    .map((s) => s.modalidad_id);

  const yaSeleccionado  = seleccionadosEnEsteEvento.length > 0;
  const enVivo          = evento.estado === 'en_curso';
  const modsPrincipales = modalidades.slice(0, 3);

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden
        ${yaSeleccionado
          ? 'border-[#10b981]/50 bg-[#10b981]/5'
          : 'border-white/8 bg-[#1e293b] hover:border-white/15'}`}
    >
      {/* ── Cabecera: liga · hora · estado ─────────────────────── */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {enVivo ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#10b981] uppercase tracking-widest shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              En Vivo
            </span>
          ) : (
            <span className="text-[10px] text-[#475569] shrink-0 tabular-nums">
              {fmtFecha(evento.fecha_inicio)}&nbsp;
              <span className="text-[#94a3b8] font-semibold">{fmtHora(evento.fecha_inicio)}</span>
            </span>
          )}
          <span className="text-[#334155] text-[10px]">·</span>
          <span className="text-[#475569] text-[10px] truncate">{evento.liga}</span>
        </div>

        {yaSeleccionado && (
          <span className="text-[10px] font-bold text-[#10b981] shrink-0 flex items-center gap-1">
            <span className="text-[8px]">✓</span> Agregado
          </span>
        )}
      </div>

      {/* ── Equipos ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3.5 py-2.5">
        <span className="text-white text-sm font-bold leading-tight">
          {evento.equipo_local}
        </span>
        <span className="text-[#334155] text-xs font-black shrink-0 px-1">VS</span>
        <span className="text-white text-sm font-bold leading-tight text-right">
          {evento.equipo_visitante}
        </span>
      </div>

      {/* ── Cuotas ──────────────────────────────────────────────── */}
      <div className="flex gap-2 px-3 pb-3">
        {modsPrincipales.map((mod) => {
          const estaSeleccionado = seleccionadosEnEsteEvento.includes(mod.id);
          return (
            <BtnCuota
              key={mod.id}
              label={mod.nombre_corto ?? mod.nombre}
              cuota={mod.cuota_base}
              seleccionado={estaSeleccionado}
              bloqueado={!estaSeleccionado && limiteAlcanzado && !yaSeleccionado}
              onClick={() => onSeleccionar(evento, mod)}
            />
          );
        })}
      </div>
    </div>
  );
}