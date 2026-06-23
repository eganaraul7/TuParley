// Archivo: NavDeportes.jsx
// Ruta: frontend/src/components/bodeguero/NavDeportes.jsx
// Función: columna izquierda del Dashboard — navegación entre las 5 categorías
//          deportivas con contador de eventos disponibles por deporte.
//          Extraído de DashboardPage.jsx (Paso 2 de reorganización components/).

import { DEPORTES } from '../../utils/constants';
import { SPORT_ICONS } from '../../assets';

export default function NavDeportes({ deporteActivo, contadores, onSeleccionar }) {
  return (
    <nav className="w-[18%] min-w-[120px] bg-[#1e293b] border-r border-white/5 flex flex-col py-3 gap-1 px-2 overflow-y-auto">
      {DEPORTES.map(({ key, label }) => {
        const Icon     = SPORT_ICONS[key];
        const activo   = deporteActivo === key;
        const cantidad = contadores[key] ?? 0;

        return (
          <button
            key={key}
            onClick={() => onSeleccionar(key)}
            className={`flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition
              ${activo
                ? 'bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981]'
                : 'text-[#94a3b8] hover:bg-white/5 hover:text-white border border-transparent'}`}
          >
            {Icon && <Icon className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium leading-tight flex-1">{label}</span>
            {cantidad > 0 && (
              <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 shrink-0
                ${activo ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-white/10 text-[#94a3b8]'}`}>
                {cantidad}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}