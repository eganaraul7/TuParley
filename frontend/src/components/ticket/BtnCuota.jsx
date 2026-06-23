// Archivo: BtnCuota.jsx
// Ruta: frontend/src/components/ticket/BtnCuota.jsx
// Función: botón individual de cuota (1/X/2 o modalidad) dentro de una tarjeta de evento.
//          Extraído de DashboardPage.jsx (Paso 1 de reorganización components/).

import { fmtCuota } from '../../utils/formatters';

export default function BtnCuota({ label, cuota, seleccionado, bloqueado, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={bloqueado}
      className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border transition select-none
        ${seleccionado
          ? 'bg-[#10b981] border-[#10b981] text-white'
          : bloqueado
            ? 'bg-white/5 border-white/5 text-[#334155] cursor-not-allowed'
            : 'bg-[#0f172a] border-white/10 text-[#94a3b8] hover:border-[#10b981]/50 hover:text-white active:scale-95'}`}
    >
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
      <span className="text-base font-bold mt-0.5">{fmtCuota(cuota)}</span>
    </button>
  );
}