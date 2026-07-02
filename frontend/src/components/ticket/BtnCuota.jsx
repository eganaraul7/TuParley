// Nombre de archivo: BtnCuota.jsx
// Ruta: frontend/src/components/ticket/BtnCuota.jsx
// Función: Botón táctil de cuota. Alto mínimo 64px para tablet.
//          Verde + sombra al seleccionar, opaco al bloquear.

import { fmtCuota } from '../../utils/formatters';

export default function BtnCuota({ label, cuota, seleccionado, bloqueado, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={bloqueado}
      className={`
        flex-1 flex flex-col items-center justify-center
        min-h-[64px] rounded-xl border transition-all duration-150 select-none
        ${seleccionado
          ? 'bg-[#10b981] border-[#10b981] text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] scale-[1.02]'
          : bloqueado
            ? 'bg-white/3 border-white/5 text-[#2d3748] cursor-not-allowed'
            : 'bg-[#0f172a] border-white/10 text-[#94a3b8] hover:border-[#10b981]/50 hover:text-white active:scale-95'}
      `}
    >
      <span className="text-[10px] uppercase tracking-wider font-medium mb-0.5">
        {label}
      </span>
      <span className="text-lg font-black leading-none">
        {fmtCuota(cuota)}
      </span>
    </button>
  );
}