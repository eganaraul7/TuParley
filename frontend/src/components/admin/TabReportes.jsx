// Archivo: TabReportes.jsx
// Ruta: frontend/src/components/admin/TabReportes.jsx
// Función: tab del panel admin — descargar reportes diario/semanal/mensual/
//          estadísticas en PDF o Word. Extraído de AdminPage.jsx (Paso 4).
//          Fix: el spinner de carga comparaba "generando === fmt" (solo
//          'pdf'/'word'), pero "generando" guarda "periodo_formato" (ej.
//          "diario_pdf") — nunca coincidía y el spinner no se mostraba en
//          los botones de diario/semanal/mensual. Corregido a comparar
//          contra la key completa.

import { useState } from 'react';
import { Loader2, Download, TrendingUp } from 'lucide-react';
import { reportesService } from '../../services/reportesService';

const PERIODOS = [
  { key: 'diario',  label: 'Reporte diario',  desc: 'Tickets y recaudación del día'  },
  { key: 'semanal', label: 'Reporte semanal', desc: 'Resumen de la semana actual'    },
  { key: 'mensual', label: 'Reporte mensual', desc: 'Estadísticas completas del mes' },
];

export default function TabReportes() {
  const [generando, setGenerando] = useState('');
  const [error, setError]         = useState('');

  async function generar(periodo, formato) {
    const key = `${periodo}_${formato}`;
    setGenerando(key); setError('');
    try {
      const blob = await reportesService.descargar(periodo, formato);
      const ext  = formato === 'pdf' ? 'pdf' : 'docx';
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `tuparley_${periodo}_${new Date().toISOString().slice(0,10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Error generando reporte.'); }
    finally { setGenerando(''); }
  }

  return (
    <div className="space-y-4 max-w-lg">
      {error && <p className="text-[#ef4444] text-xs">{error}</p>}

      {PERIODOS.map(({ key, label, desc }) => (
        <div key={key} className="bg-[#0f172a] rounded-xl p-4 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">{label}</p>
            <p className="text-[#475569] text-xs">{desc}</p>
          </div>
          <div className="flex gap-2">
            {['pdf', 'word'].map((fmt) => (
              <button key={fmt} onClick={() => generar(key, fmt)}
                disabled={!!generando}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e293b] border border-white/10 hover:border-white/20 text-[#94a3b8] hover:text-white rounded-lg text-xs transition disabled:opacity-40">
                {generando === `${key}_${fmt}`
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Download className="w-3 h-3" />}
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-[#0f172a] rounded-xl p-4 border border-white/5 flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">Estadísticas completas</p>
          <p className="text-[#475569] text-xs">Análisis por bodega, promedios y perfil de cliente</p>
        </div>
        <div className="flex gap-2">
          {['pdf', 'word'].map((fmt) => (
            <button key={fmt} onClick={() => generar('estadisticas', fmt)}
              disabled={!!generando}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/20 rounded-lg text-xs transition font-bold disabled:opacity-40">
              {generando === `estadisticas_${fmt}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}