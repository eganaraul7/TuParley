// Archivo: TarjetaEvento.jsx
// Ruta: frontend/src/components/bodeguero/TarjetaEvento.jsx
// Función: tarjeta de un evento deportivo individual con sus cuotas principales
//          (usa BtnCuota de components/ticket). Extraído de DashboardPage.jsx
//          (Paso 2 de reorganización components/).

import { fmtHora, fmtFecha } from '../../utils/formatters';
import { COLORES_ESTADO_EVENTO } from '../../utils/constants';
import BtnCuota from '../ticket/BtnCuota';

export default function TarjetaEvento({ evento, modalidades, seleccionesActivas, limiteAlcanzado, onSeleccionar }) {
  const seleccionadosEnEsteEvento = seleccionesActivas
    .filter((s) => s.evento_id === evento.id)
    .map((s) => s.modalidad_id);

  const yaSeleccionado = seleccionadosEnEsteEvento.length > 0;

  // Mostrar solo las 2-3 modalidades principales del deporte
  const modsPrincipales = modalidades.slice(0, 3);

  return (
    <div className={`bg-[#1e293b] rounded-xl border p-3 transition
      ${yaSeleccionado ? 'border-[#10b981]/30' : 'border-white/5'}`}>

      {/* cabecera evento */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-medium uppercase tracking-wider shrink-0 ${COLORES_ESTADO_EVENTO[evento.estado] ?? 'text-[#94a3b8]'}`}>
            {evento.estado === 'en_curso' ? '● EN VIVO' : `${fmtFecha(evento.fecha_inicio)} ${fmtHora(evento.fecha_inicio)}`}
          </span>
          <span className="text-[#475569] text-[10px] truncate">{evento.liga}</span>
        </div>
        {yaSeleccionado && (
          <span className="text-[#10b981] text-[10px] font-bold shrink-0">✓ Agregado</span>
        )}
      </div>

      {/* equipos */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-semibold truncate flex-1">{evento.equipo_local}</span>
        <span className="text-[#475569] text-xs font-bold mx-2 shrink-0">VS</span>
        <span className="text-white text-sm font-semibold truncate flex-1 text-right">{evento.equipo_visitante}</span>
      </div>

      {/* cuotas */}
      <div className="flex gap-2">
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