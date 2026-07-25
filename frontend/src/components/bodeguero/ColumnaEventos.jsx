// Nombre de archivo: ColumnaEventos.jsx
// Ruta: frontend/src/components/bodeguero/ColumnaEventos.jsx
// Función: Eventos del deporte activo agrupados por torneo (accordion).
//          Fetch paralelo de torneos + eventos. Agrupa por liga client-side.

import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Loader2, AlertTriangle, Calendar, ChevronDown } from 'lucide-react';
import { eventosService } from '../../services/eventosService';
import TarjetaEvento from './TarjetaEvento';

export default function ColumnaEventos({
  deporte,
  seleccionesActivas,
  limiteAlcanzado,
  onSeleccionar,
  onActualizarMarcador,
}) {
  const [eventos,        setEventos]        = useState([]);
  const [torneos,        setTorneos]        = useState([]);
  const [modalidades,    setModalidades]    = useState([]);
  const [cuotasMarcador, setCuotasMarcador] = useState([]);
  const [cuotasDetalle,  setCuotasDetalle]  = useState([]);
  const [cargando,       setCargando]       = useState(false);
  const [error,          setError]          = useState('');
  const [busqueda,       setBusqueda]       = useState('');
  const [expandidos,     setExpandidos]     = useState({});   // { nombre_liga: boolean }

  useEffect(() => {
    setEventos([]);
    setTorneos([]);
    setBusqueda('');
    setExpandidos({});
    cargar();
  }, [deporte]);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const [evRes, torRes, modRes, cmRes, cdRes] = await Promise.all([
        eventosService.listar({ deporte, limite: 100 }),
        eventosService.listarTorneos(deporte),
        eventosService.listarModalidades(deporte),
        eventosService.listarCuotasMarcador(deporte),
        eventosService.listarCuotasDetalle(deporte),
      ]);

      const evs  = evRes.eventos       ?? [];
      const tors = torRes.torneos      ?? [];
      const mods = modRes.modalidades  ?? [];
      const cms  = cmRes.cuotas        ?? [];
      const cds  = cdRes.cuotas        ?? [];

      setEventos(evs);
      setTorneos(tors);
      setModalidades(mods);
      setCuotasMarcador(cms);
      setCuotasDetalle(cds);

      // Expandir el primer torneo con eventos por defecto
      const ligasConEventos = [...new Set(evs.map((e) => e.liga))];
      if (ligasConEventos.length > 0) {
        setExpandidos({ [ligasConEventos[0]]: true });
      }
    } catch {
      setError('No se pudieron cargar los eventos.');
    } finally {
      setCargando(false);
    }
  }

  function toggleTorneo(liga) {
    setExpandidos((prev) => ({ ...prev, [liga]: !prev[liga] }));
  }

  // Filtrar eventos por búsqueda
  const eventosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return eventos;
    const q = busqueda.toLowerCase();
    return eventos.filter(
      (e) =>
        e.equipo_local.toLowerCase().includes(q) ||
        e.equipo_visitante.toLowerCase().includes(q) ||
        e.liga?.toLowerCase().includes(q),
    );
  }, [eventos, busqueda]);

  // Agrupar por liga manteniendo el orden de torneos activos
  const grupos = useMemo(() => {
    // Orden base: torneos registrados en BD (ya vienen ordenados por nombre)
    const ligasOrdenadas = torneos.map((t) => t.nombre_liga);

    // Ligas en eventos que no estén en torneos (recién detectadas, no registradas aún)
    const ligasExtra = [...new Set(eventosFiltrados.map((e) => e.liga))]
      .filter((l) => !ligasOrdenadas.includes(l));

    const todasLigas = [...ligasOrdenadas, ...ligasExtra];

    return todasLigas
      .map((liga) => ({
        liga,
        eventos: eventosFiltrados.filter((e) => e.liga === liga),
      }))
      .filter((g) => g.eventos.length > 0);
  }, [torneos, eventosFiltrados]);

  const totalEventos = eventosFiltrados.length;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

      {/* ── Sub-barra ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar equipo o torneo…"
            className="w-full bg-[#0f172a] text-white placeholder-[#334155] text-xs border border-white/8 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-[#10b981] transition"
          />
        </div>

        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-white text-xs border border-white/8 hover:border-white/20 rounded-lg px-3 py-2 transition disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>

        <span className="text-[#334155] text-xs ml-auto tabular-nums shrink-0">
          {totalEventos} evento{totalEventos !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Contenido ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">

        {/* Cargando */}
        {cargando && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-[#10b981]/20 border-t-[#10b981] animate-spin" />
            <span className="text-[#475569] text-sm">Cargando eventos…</span>
          </div>
        )}

        {/* Error */}
        {!cargando && error && (
          <div className="flex items-center gap-2.5 text-[#ef4444] text-sm bg-[#ef4444]/8 border border-[#ef4444]/20 rounded-xl p-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Vacío */}
        {!cargando && !error && grupos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Calendar className="w-10 h-10 text-[#1e293b]" />
            <span className="text-[#334155] text-sm">Sin eventos disponibles</span>
            <span className="text-[#1e293b] text-xs">Prueba con otro deporte o actualiza</span>
          </div>
        )}

        {/* Grupos por torneo */}
        {!cargando && !error && grupos.map(({ liga, eventos: evs }) => {
          const abierto = !!expandidos[liga];
          const conSeleccion = evs.some((e) =>
            seleccionesActivas.some((s) => s.evento_id === e.id)
          );

          return (
            <div
              key={liga}
              className={`rounded-xl border overflow-hidden transition-colors
                ${conSeleccion ? 'border-[#10b981]/25' : 'border-white/5'}`}
            >
              {/* Header del torneo */}
              <button
                onClick={() => toggleTorneo(liga)}
                className={`w-full flex items-center justify-between px-4 py-3 transition
                  ${abierto ? 'bg-[#1e293b]' : 'bg-[#1a2535] hover:bg-[#1e293b]'}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {conSeleccion && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0" />
                  )}
                  <span className="text-white text-xs font-bold truncate">{liga}</span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 ml-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${abierto ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-white/8 text-[#475569]'}`}>
                    {evs.length}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#475569] transition-transform duration-200
                    ${abierto ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {/* Eventos del torneo */}
              {abierto && (
                <div className="bg-[#0f172a]/50 p-2.5 space-y-2">
                  {evs.map((evento) => (
                    <TarjetaEvento
                      key={evento.id}
                      evento={evento}
                      modalidades={modalidades}
                      seleccionesActivas={seleccionesActivas}
                      limiteAlcanzado={limiteAlcanzado}
                      cuotasMarcador={cuotasMarcador}
                      cuotasDetalle={cuotasDetalle}
                      onSeleccionar={onSeleccionar}
                      onActualizarMarcador={onActualizarMarcador}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}