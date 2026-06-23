// Archivo: TabEventos.jsx
// Ruta: frontend/src/components/admin/TabEventos.jsx
// Función: tab del panel admin — activar/desactivar categorías deportivas y
//          modalidades individuales. Extraído de AdminPage.jsx (Paso 4).
//          Fix: usaba un array DEPORTES local (solo keys, sin label);
//          ahora usa el DEPORTES centralizado de utils/constants.js.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { eventosService } from '../../services/eventosService';
import { DEPORTES } from '../../utils/constants';

export default function TabEventos() {
  const [categorias, setCategorias]   = useState([]);
  const [modalidades, setModalidades] = useState([]);
  const [cargando, setCargando]       = useState(false);
  const [error, setError]             = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [cRes, mRes] = await Promise.all([
        eventosService.listarCategorias(),
        eventosService.listarModalidades(),
      ]);
      setCategorias(cRes.categorias ?? []);
      setModalidades(mRes.modalidades ?? []);
    } catch { setError('Error cargando configuración.'); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, []);

  async function toggleCategoria(deporte) {
    try { await eventosService.toggleCategoria(deporte); cargar(); }
    catch { setError('Error al cambiar estado de categoría.'); }
  }

  async function toggleModalidad(id) {
    try { await eventosService.toggleModalidad(id); cargar(); }
    catch { setError('Error al cambiar estado de modalidad.'); }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-[#ef4444] text-xs">{error}</p>}

      {/* categorias */}
      <div>
        <h3 className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-3">Categorías deportivas</h3>
        <div className="grid grid-cols-5 gap-2">
          {DEPORTES.map(({ key: dep, label }) => {
            const cat = categorias.find((c) => c.deporte === dep);
            const activa = cat?.activa ?? true;
            return (
              <button key={dep} onClick={() => toggleCategoria(dep)}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-xs font-medium transition
                  ${activa
                    ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
                    : 'bg-[#0f172a] border-white/10 text-[#475569]'}`}>
                {activa
                  ? <ToggleRight className="w-5 h-5" />
                  : <ToggleLeft  className="w-5 h-5" />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* modalidades */}
      <div>
        <h3 className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-3">Modalidades</h3>
        {cargando ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#10b981] animate-spin" /></div>
        ) : (
          <div className="space-y-1">
            {modalidades.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-[#0f172a] rounded-xl px-4 py-3 border border-white/5">
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium">{m.nombre}</p>
                  <p className="text-[#475569] text-[11px] capitalize">{m.deporte} · {m.dificultad}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[#10b981] text-xs font-bold">{Number(m.cuota_base).toFixed(2)}×</span>
                  <button onClick={() => toggleModalidad(m.id)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border transition
                      ${m.activa
                        ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 hover:bg-[#10b981]/20'
                        : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/20'}`}>
                    {m.activa ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}