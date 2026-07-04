// Nombre de archivo: TabEventos.jsx
// Ruta: frontend/src/components/admin/TabEventos.jsx
// Función: Admin — toggle de categorías, torneos individuales y modalidades.
//          Torneos agrupados por deporte con toggle optimista + revert en error.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, ToggleLeft, ToggleRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { eventosService } from '../../services/eventosService';
import { DEPORTES } from '../../utils/constants';

// ── Toggle switch reutilizable ────────────────────────────────────────────────
function Toggle({ activo, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed
        ${activo ? 'bg-[#10b981]' : 'bg-[#1e293b] border border-white/10'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150
        ${activo ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

// ── Sección colapsable ────────────────────────────────────────────────────────
function Seccion({ titulo, children, defaultOpen = false }) {
  const [abierta, setAbierta] = useState(defaultOpen);
  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setAbierta((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1e293b] hover:bg-[#243044] transition"
      >
        <span className="text-[#94a3b8] text-xs uppercase tracking-wider font-semibold">{titulo}</span>
        <ChevronDown className={`w-4 h-4 text-[#475569] transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && <div className="p-3 bg-[#0f172a]/60">{children}</div>}
    </div>
  );
}

export default function TabEventos() {
  const [categorias,  setCategorias]  = useState([]);
  const [torneos,     setTorneos]     = useState([]);
  const [modalidades, setModalidades] = useState([]);
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState('');
  const [toggling,    setToggling]    = useState({});   // { key: true }

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [cRes, tRes, mRes] = await Promise.all([
        eventosService.listarCategorias(),
        eventosService.listarTorneos(),
        eventosService.listarModalidades(),
      ]);
      setCategorias(cRes.categorias   ?? []);
      setTorneos(tRes.torneos         ?? []);
      setModalidades(mRes.modalidades ?? []);
    } catch {
      setError('Error cargando configuración.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Toggle genérico con optimistic update ─────────────────────────────────
  async function optimisticToggle(key, fn, onUpdate, onRevert) {
    if (toggling[key]) return;
    setToggling((p) => ({ ...p, [key]: true }));
    onUpdate();
    try {
      await fn();
    } catch {
      onRevert();
      setError('Error al cambiar estado.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setToggling((p) => ({ ...p, [key]: false }));
    }
  }

  // ── Categoría ─────────────────────────────────────────────────────────────
  function handleCategoria(deporte) {
    const cat       = categorias.find((c) => c.deporte === deporte);
    const anterior  = cat?.activa ?? 1;
    const key       = `cat-${deporte}`;
    optimisticToggle(
      key,
      () => eventosService.toggleCategoria(deporte),
      () => setCategorias((prev) => prev.map((c) => c.deporte === deporte ? { ...c, activa: !anterior } : c)),
      () => setCategorias((prev) => prev.map((c) => c.deporte === deporte ? { ...c, activa: anterior  } : c)),
    );
  }

  // ── Torneo ────────────────────────────────────────────────────────────────
  function handleTorneo(id) {
    const torneo   = torneos.find((t) => t.id === id);
    const anterior = torneo?.activo ?? 1;
    const key      = `tor-${id}`;
    optimisticToggle(
      key,
      () => eventosService.toggleTorneo(id),
      () => setTorneos((prev) => prev.map((t) => t.id === id ? { ...t, activo: !anterior } : t)),
      () => setTorneos((prev) => prev.map((t) => t.id === id ? { ...t, activo: anterior  } : t)),
    );
  }

  // ── Modalidad ─────────────────────────────────────────────────────────────
  function handleModalidad(id) {
    const mod      = modalidades.find((m) => m.id === id);
    const anterior = mod?.activa ?? 1;
    const key      = `mod-${id}`;
    optimisticToggle(
      key,
      () => eventosService.toggleModalidad(id),
      () => setModalidades((prev) => prev.map((m) => m.id === id ? { ...m, activa: !anterior } : m)),
      () => setModalidades((prev) => prev.map((m) => m.id === id ? { ...m, activa: anterior  } : m)),
    );
  }

  // ── Torneos agrupados por deporte ─────────────────────────────────────────
  const torneosPorDeporte = DEPORTES.map(({ key, label }) => ({
    key,
    label,
    items: torneos.filter((t) => t.deporte === key),
  })).filter((g) => g.items.length > 0);

  if (cargando) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-6 h-6 text-[#10b981] animate-spin" />
    </div>
  );

  return (
    <div className="space-y-3 max-w-2xl">

      {error && (
        <div className="flex items-center gap-2 text-[#ef4444] text-xs bg-[#ef4444]/8 border border-[#ef4444]/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── 1. Categorías ─────────────────────────────────────────────── */}
      <Seccion titulo="Categorías deportivas" defaultOpen>
        <div className="grid grid-cols-5 gap-2">
          {DEPORTES.map(({ key: dep, label }) => {
            const cat    = categorias.find((c) => c.deporte === dep);
            const activa = cat ? !!cat.activa : true;
            return (
              <button
                key={dep}
                onClick={() => handleCategoria(dep)}
                disabled={!!toggling[`cat-${dep}`]}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-xs font-semibold transition
                  ${activa
                    ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
                    : 'bg-[#0f172a] border-white/8 text-[#475569]'}`}
              >
                {toggling[`cat-${dep}`]
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : activa
                    ? <ToggleRight className="w-5 h-5" />
                    : <ToggleLeft  className="w-5 h-5" />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </Seccion>

      {/* ── 2. Torneos ────────────────────────────────────────────────── */}
      <Seccion titulo="Torneos / Ligas" defaultOpen>
        {torneosPorDeporte.length === 0 ? (
          <p className="text-[#334155] text-xs text-center py-6">
            Sin torneos registrados — se auto-registran al sincronizar eventos
          </p>
        ) : (
          <div className="space-y-3">
            {torneosPorDeporte.map(({ key, label, items }) => (
              <div key={key}>
                {/* Sub-cabecera deporte */}
                <p className="text-[#475569] text-[10px] uppercase tracking-widest font-bold px-1 mb-1.5">
                  {label}
                </p>
                <div className="space-y-1">
                  {items.map((t) => {
                    const activo = !!t.activo;
                    const busy   = !!toggling[`tor-${t.id}`];
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-[#0f172a] rounded-xl px-4 py-2.5 border border-white/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium truncate ${activo ? 'text-white' : 'text-[#475569]'}`}>
                            {t.nombre_liga}
                          </p>
                          <p className="text-[#334155] text-[10px]">
                            {t.eventos_disponibles ?? 0} evento{(t.eventos_disponibles ?? 0) !== 1 ? 's' : ''} activos
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 ml-3">
                          <span className={`text-[10px] font-bold ${activo ? 'text-[#10b981]' : 'text-[#334155]'}`}>
                            {activo ? 'ON' : 'OFF'}
                          </span>
                          {busy
                            ? <Loader2 className="w-4 h-4 text-[#475569] animate-spin" />
                            : <Toggle activo={activo} onChange={() => handleTorneo(t.id)} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {/* ── 3. Modalidades ────────────────────────────────────────────── */}
      <Seccion titulo="Modalidades de apuesta">
        <div className="space-y-1">
          {modalidades.map((m) => {
            const busy = !!toggling[`mod-${m.id}`];
            return (
              <div
                key={m.id}
                className="flex items-center justify-between bg-[#0f172a] rounded-xl px-4 py-3 border border-white/5"
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium ${m.activa ? 'text-white' : 'text-[#475569]'}`}>
                    {m.nombre}
                  </p>
                  <p className="text-[#334155] text-[10px] capitalize">
                    {m.deporte} · {m.dificultad}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-[#10b981] text-xs font-black tabular-nums">
                    {Number(m.cuota_base).toFixed(2)}×
                  </span>
                  {busy
                    ? <Loader2 className="w-4 h-4 text-[#475569] animate-spin" />
                    : <Toggle activo={!!m.activa} onChange={() => handleModalidad(m.id)} />}
                </div>
              </div>
            );
          })}
        </div>
      </Seccion>
    </div>
  );
}