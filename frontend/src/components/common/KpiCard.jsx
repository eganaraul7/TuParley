// Archivo: KpiCard.jsx
// Ruta: frontend/src/components/common/KpiCard.jsx
// Función: tarjeta genérica de indicador numérico (ícono + label + valor).
//          Reutilizable fuera de Cierre de Caja si se necesita en otras pantallas.
//          Extraído de CierreCajaPage.jsx (Paso 3 de reorganización components/).

export default function KpiCard({ icono: Icono, label, valorPrincipal, valorSecundario, color = 'text-white' }) {
  return (
    <div className="bg-[#0f172a] rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <Icono className="w-4 h-4 text-[#94a3b8]" />
        <span className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{valorPrincipal}</p>
      {valorSecundario && <p className="text-[#475569] text-xs mt-0.5">{valorSecundario}</p>}
    </div>
  );
}