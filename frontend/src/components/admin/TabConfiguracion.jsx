// Archivo: TabConfiguracion.jsx
// Ruta: frontend/src/components/admin/TabConfiguracion.jsx
// Función: tab del panel admin — toggle de modo mantenimiento global y
//          parámetros del sistema (solo lectura). Extraído de AdminPage.jsx
//          (Paso 4 de reorganización components/).

import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { adminService } from '../../services/adminService';

export default function TabConfiguracion() {
  const [mantenimiento, setMantenimiento] = useState(false);
  const [guardando, setGuardando]         = useState(false);
  const [ok, setOk]                       = useState('');
  const [error, setError]                 = useState('');

  useEffect(() => {
    adminService.getMantenimiento()
      .then((r) => setMantenimiento(r?.activo ?? false))
      .catch(() => {});
  }, []);

  async function toggleMantenimiento() {
    setGuardando(true); setOk(''); setError('');
    try {
      const nuevoEstado = !mantenimiento;
      await adminService.setMantenimiento(nuevoEstado);
      setMantenimiento(nuevoEstado);
      setOk(nuevoEstado ? 'Modo mantenimiento activado. Todas las tablets bloqueadas.' : 'Modo mantenimiento desactivado.');
    } catch { setError('No se pudo cambiar el modo de mantenimiento.'); }
    finally { setGuardando(false); }
  }

  return (
    <div className="max-w-lg space-y-4">
      {error && <p className="text-[#ef4444] text-xs">{error}</p>}
      {ok    && <p className="text-[#10b981] text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{ok}</p>}

      {/* modo mantenimiento */}
      <div className="bg-[#0f172a] rounded-xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white text-sm font-bold">Modo mantenimiento</p>
            <p className="text-[#94a3b8] text-xs mt-0.5">
              Bloquea todas las tablets de bodegueros y desconocidos simultáneamente.
              Los administradores siguen con acceso.
            </p>
          </div>
          <button onClick={toggleMantenimiento} disabled={guardando}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-50
              ${mantenimiento ? 'bg-[#ef4444]' : 'bg-[#1e293b] border border-white/10'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
              ${mantenimiento ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {mantenimiento && (
          <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg px-3 py-2">
            <p className="text-[#ef4444] text-xs font-medium">⚠ Sistema en mantenimiento — bodegueros no pueden operar</p>
          </div>
        )}
      </div>

      {/* info config */}
      <div className="bg-[#0f172a] rounded-xl p-4 border border-white/5 space-y-3">
        <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium">Parámetros del sistema</p>
        {[
          { label: 'Ganancia máxima por ticket', valor: '$300 USD' },
          { label: 'Apuesta mínima',              valor: '$1 USD' },
          { label: 'Plazo de cobro de premios',   valor: '48 horas' },
          { label: 'Intentos de login',           valor: '5 antes del bloqueo' },
          { label: 'Horario de apertura',         valor: '5:00 AM' },
          { label: 'Horario de cierre',           valor: '7:00 PM' },
          { label: 'Comisión bodeguero',          valor: '20%' },
          { label: 'Comisión operador',           valor: '80%' },
        ].map(({ label, valor }) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-[#94a3b8]">{label}</span>
            <span className="text-white font-medium">{valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}