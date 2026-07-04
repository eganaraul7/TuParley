import { useState, useEffect } from 'react';
import { Printer, QrCode, RefreshCw, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { bodegaService } from '../../services/bodegaService';

function ToggleSwitch({ activo, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed
        ${activo ? 'bg-[#10b981]' : 'bg-[#1e293b] border border-white/10'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
        ${activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function TabBodegas() {
  const [bodegas,   setBodegas]   = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState('');
  const [guardando, setGuardando] = useState({});
  const [feedback,  setFeedback]  = useState({});

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true); setError('');
    try {
      const { bodegas: data } = await bodegaService.listar();
      setBodegas(data.map((b) => ({
        ...b,
        fisica_activa:  b.fisica_activa  ?? 1,
        digital_activa: b.digital_activa ?? 1,
      })));
    } catch {
      setError('No se pudieron cargar las bodegas.');
    } finally {
      setCargando(false);
    }
  }

  async function handleToggle(bodegaId, campo) {
    const bodega   = bodegas.find((b) => b.id === bodegaId);
    const esActivo = bodega[campo];
    const otro     = campo === 'fisica_activa' ? 'digital_activa' : 'fisica_activa';

    if (esActivo && !bodega[otro]) {
      setFeedback((p) => ({ ...p, [bodegaId]: { msg: 'Al menos un modo debe quedar activo', tipo: 'error' } }));
      setTimeout(() => setFeedback((p) => ({ ...p, [bodegaId]: null })), 3000);
      return;
    }

    setGuardando((p) => ({ ...p, [bodegaId]: campo }));
    setBodegas((p) => p.map((b) => b.id === bodegaId ? { ...b, [campo]: !esActivo } : b));

    try {
      await bodegaService.actualizarConfigImpresion(bodegaId, { [campo]: !esActivo });
      setFeedback((p) => ({ ...p, [bodegaId]: { msg: 'Guardado', tipo: 'ok' } }));
      setTimeout(() => setFeedback((p) => ({ ...p, [bodegaId]: null })), 2000);
    } catch (err) {
      setBodegas((p) => p.map((b) => b.id === bodegaId ? { ...b, [campo]: esActivo } : b));
      setFeedback((p) => ({ ...p, [bodegaId]: { msg: err.response?.data?.error ?? 'Error al guardar', tipo: 'error' } }));
      setTimeout(() => setFeedback((p) => ({ ...p, [bodegaId]: null })), 3000);
    } finally {
      setGuardando((p) => ({ ...p, [bodegaId]: null }));
    }
  }

  if (cargando) return (
    <div className="flex items-center gap-2 text-[#475569] py-12 justify-center">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando bodegas…
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-[#ef4444] text-sm py-12 justify-center">
      <AlertTriangle className="w-4 h-4" /> {error}
    </div>
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm">Configuración de Impresión por Bodega</h3>
          <p className="text-[#475569] text-xs mt-0.5">Al menos un modo debe permanecer activo por bodega.</p>
        </div>
        <button onClick={cargar}
          className="flex items-center gap-1.5 text-[#475569] hover:text-white text-xs border border-white/8 hover:border-white/20 rounded-lg px-3 py-2 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-[#475569] px-1">
        <span className="flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" /> Impresión Física</span>
        <span className="flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> QR Digital</span>
      </div>

      {bodegas.length === 0
        ? <p className="text-[#334155] text-sm text-center py-10">Sin bodegas registradas</p>
        : (
          <div className="space-y-2">
            {bodegas.map((bodega) => {
              const fb  = feedback[bodega.id];
              const bsy = guardando[bodega.id];
              return (
                <div key={bodega.id} className="bg-[#0f172a] rounded-xl border border-white/5 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${bodega.activa ? 'bg-[#10b981]' : 'bg-[#334155]'}`} />
                        <p className="text-white font-bold text-sm truncate">{bodega.nombre}</p>
                        <span className="text-[#334155] text-[10px] shrink-0">#{bodega.id}</span>
                      </div>
                      {bodega.ubicacion && <p className="text-[#475569] text-xs mt-0.5 pl-4">{bodega.ubicacion}</p>}
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1.5 text-[#475569]">
                          {bsy === 'fisica_activa' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                          <span className="text-[10px] uppercase tracking-wider font-medium">Física</span>
                        </div>
                        <ToggleSwitch
                          activo={!!bodega.fisica_activa}
                          onChange={() => handleToggle(bodega.id, 'fisica_activa')}
                          disabled={!!bsy}
                        />
                      </div>
                      <div className="w-px h-8 bg-white/5" />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1.5 text-[#475569]">
                          {bsy === 'digital_activa' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                          <span className="text-[10px] uppercase tracking-wider font-medium">QR Digital</span>
                        </div>
                        <ToggleSwitch
                          activo={!!bodega.digital_activa}
                          onChange={() => handleToggle(bodega.id, 'digital_activa')}
                          disabled={!!bsy}
                        />
                      </div>
                    </div>
                  </div>

                  {fb && (
                    <div className={`mt-2.5 flex items-center gap-1.5 text-xs ${fb.tipo === 'ok' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {fb.tipo === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {fb.msg}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}