// Nombre de archivo: NavDeportes.jsx
// Ruta: frontend/src/components/bodeguero/NavDeportes.jsx
// Función: Columna de navegación vertical entre deportes. Indica el activo
//          con borde izquierdo verde y fondo sutil. Contador de eventos.

import { DEPORTES } from '../../utils/constants';
import { SPORT_ICONS } from '../../assets';

export default function NavDeportes({ deporteActivo, contadores, onSeleccionar }) {
  return (
    <nav className="w-[18%] min-w-[120px] bg-[#1e293b] border-r border-white/5 flex flex-col py-4 gap-1 px-2 overflow-y-auto">

      <p className="text-[#334155] text-[10px] uppercase tracking-widest font-semibold px-3 mb-2">
        Deportes
      </p>

      {DEPORTES.map(({ key, label }) => {
        const Icon     = SPORT_ICONS[key];
        const activo   = deporteActivo === key;
        const cantidad = contadores[key] ?? 0;

        return (
          <button
            key={key}
            onClick={() => onSeleccionar(key)}
            className={`
              relative flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all duration-150
              ${activo
                ? 'bg-[#10b981]/10 text-[#10b981]'
                : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'}
            `}
          >
            {/* Borde izquierdo activo */}
            {activo && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#10b981] rounded-r-full" />
            )}

            {Icon && <Icon className="w-5 h-5 shrink-0" />}

            <span className="text-sm font-semibold leading-tight flex-1">{label}</span>

            {cantidad > 0 && (
              <span
                className={`text-[11px] font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0
                  ${activo
                    ? 'bg-[#10b981]/25 text-[#10b981]'
                    : 'bg-white/8 text-[#475569]'}`}
              >
                {cantidad > 99 ? '99+' : cantidad}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}