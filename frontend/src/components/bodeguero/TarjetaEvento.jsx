// Nombre de archivo: TarjetaEvento.jsx
// Ruta: frontend/src/components/bodeguero/TarjetaEvento.jsx
// Función: Tarjeta visual de un evento deportivo con cuotas táctiles optimizadas
//          para tablet. Borde verde al tener selección activa en este evento.
//          Botones local / empate / visitante (modalidades con tipo_resultado_btn)
//          y panel opcional de marcador exacto / detalle de fin.

import { fmtHora, fmtFecha, fmtCuota } from '../../utils/formatters';
import { COLORES_ESTADO_EVENTO } from '../../utils/constants';
import BtnCuota from '../ticket/BtnCuota';

const ORDEN_BTN = { local: 0, empate: 1, visitante: 2 };
const DETALLE_LABEL = {
  tiempo_extra: 'T. Extra', penales: 'Penales',
  ko: 'KO', tko: 'TKO', sumision: 'Sumisión', decision: 'Decisión',
};

// Marcadores coherentes con el botón elegido (el backend valida lo mismo)
function marcadoresPara(cuotasMarcador, deporte, tipo) {
  return cuotasMarcador.filter((c) => {
    if (c.deporte !== deporte) return false;
    if (c.tipo_marcador === 'rango_margen') return tipo !== 'empate';
    const ml = Number(c.marcador_local);
    const mv = Number(c.marcador_visitante);
    return tipo === 'local' ? ml > mv : tipo === 'visitante' ? ml < mv : ml === mv;
  });
}

function detallesPara(cuotasDetalle, evento, tipo) {
  const aplica =
    (evento.deporte === 'futbol' && tipo === 'empate' && evento.tipo_fase === 'eliminatoria') ||
    (evento.deporte === 'mma' && tipo !== 'empate');
  return aplica ? cuotasDetalle.filter((c) => c.deporte === evento.deporte) : [];
}

function Chip({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition
        ${activo
          ? 'bg-[#10b981] border-[#10b981] text-white'
          : 'bg-[#0f172a] border-white/10 text-[#94a3b8] hover:text-white'}`}
    >
      {children}
    </button>
  );
}

export default function TarjetaEvento({
  evento,
  modalidades,
  seleccionesActivas,
  limiteAlcanzado,
  cuotasMarcador = [],
  cuotasDetalle  = [],
  onSeleccionar,
  onActualizarMarcador,
}) {
  const seleccionActual = seleccionesActivas.find((s) => s.evento_id === evento.id) ?? null;
  const seleccionadosEnEsteEvento = seleccionActual ? [seleccionActual.modalidad_id] : [];

  const yaSeleccionado  = seleccionadosEnEsteEvento.length > 0;
  const enVivo          = evento.estado === 'en_curso';
  // Solo las modalidades de resultado directo se pueden apostar (las demás no se liquidan)
  const modsPrincipales = modalidades
    .filter((m) => m.tipo_resultado_btn && m.deporte === evento.deporte)
    .sort((a, b) => ORDEN_BTN[a.tipo_resultado_btn] - ORDEN_BTN[b.tipo_resultado_btn]);

  const tipoActual = seleccionActual?.tipo_resultado ?? null;
  const opcionesMarcador = tipoActual ? marcadoresPara(cuotasMarcador, evento.deporte, tipoActual) : [];
  const opcionesDetalle  = tipoActual ? detallesPara(cuotasDetalle, evento, tipoActual) : [];

  function etiqueta(mod) {
    if (mod.tipo_resultado_btn === 'local')     return evento.equipo_local;
    if (mod.tipo_resultado_btn === 'visitante') return evento.equipo_visitante;
    return 'Empate';
  }

  function elegirMarcador(c) {
    const igual = seleccionActual.marcador_local === Number(c.marcador_local)
      && seleccionActual.marcador_visitante === Number(c.marcador_visitante);
    onActualizarMarcador?.(evento.id, igual
      ? { marcador_local: null, marcador_visitante: null, cuota_marcador: 1 }
      : { marcador_local: Number(c.marcador_local), marcador_visitante: Number(c.marcador_visitante), cuota_marcador: Number(c.multiplicador) });
  }

  function elegirDetalle(c) {
    const igual = seleccionActual.detalle_fin === c.tipo_detalle;
    onActualizarMarcador?.(evento.id, igual
      ? { detalle_fin: null, cuota_detalle: 1 }
      : { detalle_fin: c.tipo_detalle, cuota_detalle: Number(c.multiplicador) });
  }

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
              label={etiqueta(mod)}
              cuota={mod.cuota_base}
              seleccionado={estaSeleccionado}
              bloqueado={!estaSeleccionado && limiteAlcanzado && !yaSeleccionado}
              onClick={() => onSeleccionar(evento, mod)}
            />
          );
        })}
        {modsPrincipales.length === 0 && (
          <span className="text-[#475569] text-xs py-3">Sin cuotas disponibles</span>
        )}
      </div>

      {/* ── Opcionales: marcador exacto / detalle de fin ─────────── */}
      {seleccionActual && (opcionesMarcador.length > 0 || opcionesDetalle.length > 0) && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
          {opcionesMarcador.length > 0 && (
            <div>
              <p className="text-[#475569] text-[10px] uppercase tracking-wider mb-1">
                {evento.deporte === 'baloncesto' ? 'Diferencia de puntos (opcional)' : 'Marcador exacto (opcional)'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {opcionesMarcador.map((c) => (
                  <Chip
                    key={c.id}
                    activo={seleccionActual.marcador_local === Number(c.marcador_local)
                      && seleccionActual.marcador_visitante === Number(c.marcador_visitante)}
                    onClick={() => elegirMarcador(c)}
                  >
                    {c.etiqueta} · {fmtCuota(c.multiplicador)}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {opcionesDetalle.length > 0 && (
            <div>
              <p className="text-[#475569] text-[10px] uppercase tracking-wider mb-1">
                {evento.deporte === 'mma' ? 'Método de victoria (opcional)' : 'Cómo se define (opcional)'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {opcionesDetalle.map((c) => (
                  <Chip key={c.id} activo={seleccionActual.detalle_fin === c.tipo_detalle} onClick={() => elegirDetalle(c)}>
                    {DETALLE_LABEL[c.tipo_detalle] ?? c.tipo_detalle} · {fmtCuota(c.multiplicador)}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}