// Archivo: TabBcv.jsx
// Ruta: frontend/src/components/admin/TabBcv.jsx
// Función: tab del panel admin — ver tasa BCV actual y forzar tasa manual
//          (rango 30-200 Bs/$). Extraído de AdminPage.jsx (Paso 4).

import { useState } from 'react';
import { Loader2, DollarSign, CheckCircle } from 'lucide-react';
import { useBcvStore } from '../../store/bcvStore';
import { bcvService } from '../../services/bcvService';

export default function TabBcv() {
  const tasaBcv = useBcvStore((s) => s.tasaBcv);
  const [valor, setValor]         = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk]               = useState(false);
  const [error, setError]         = useState('');

  async function handleGuardar() {
    const num = Number(valor);
    if (isNaN(num) || num < 30 || num > 200) {
      setError('El valor debe estar entre 30 y 200 Bs/$.');
      return;
    }
    setGuardando(true); setError(''); setOk(false);
    try {
      await bcvService.setManual(num);
      setOk(true); setValor('');
    } catch (err) { setError(err.response?.data?.mensaje ?? 'Error al guardar.'); }
    finally { setGuardando(false); }
  }

  return (
    <div className="max-w-sm space-y-4">
      <div className="bg-[#0f172a] rounded-xl p-5 border border-white/5 text-center">
        <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-1">Tasa BCV actual</p>
        <p className="text-[#10b981] text-4xl font-bold">
          {tasaBcv ? `Bs ${Number(tasaBcv).toFixed(2)}` : '—'}
        </p>
        <p className="text-[#475569] text-xs mt-1">por $1 USD</p>
      </div>

      <div>
        <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">
          Nueva tasa manual
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-xs font-bold">Bs</span>
          <input type="number" min="30" max="200" step="0.01"
            value={valor} onChange={(e) => { setValor(e.target.value); setOk(false); setError(''); }}
            placeholder="45.20"
            className="w-full bg-[#0f172a] text-white border border-white/10 rounded-xl pl-9 pr-4 py-3 text-right font-bold focus:outline-none focus:border-[#10b981]" />
        </div>
        <p className="text-[#475569] text-xs mt-1">Rango válido: 30 – 200 Bs/$</p>
      </div>

      {error && <p className="text-[#ef4444] text-xs">{error}</p>}
      {ok    && <p className="text-[#10b981] text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Tasa actualizada y difundida a todas las tablets.</p>}

      <button onClick={handleGuardar} disabled={guardando || !valor}
        className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
        Aplicar tasa
      </button>
    </div>
  );
}