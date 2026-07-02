// Nombre de archivo: ColumnaEventos.jsx
// Ruta: frontend/src/components/bodeguero/ColumnaEventos.jsx
// Función: Columna central del Dashboard. Carga eventos del deporte activo,
//          permite filtrar por texto. Preparada para agrupación por torneo (Paso 4).

import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { eventosService } from '../../services/eventosService';
import TarjetaEvento from './TarjetaEvento';

export default function ColumnaEventos({
  deporte,
  seleccionesActivas,
  limiteAlcanzado,
  onSeleccionar,
}) {
  const [eventos,     setEventos]     = useState([]);
  const [modalidades, setModalidades] = useState([]);
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState('');
  const [busquedaEv,  setBusquedaEv]  = useState('');

  useEffect(() => {
    setEventos([]);
    setBusquedaEv('');
    cargar();
  }, [deporte]);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const [evRes, modRes] = await Promise.all([
        eventosService.listar({ deporte, limite: 50 }),
        eventosService.listarModalidades(deporte),
      ]);
      setEventos(evRes.eventos ?? []);
      setModalidades(modRes.modalidades ?? []);
    } catch {
      setError('No se pudieron cargar los eventos.');
    } finally {
      setCargando(false);
    }
  }

  const eventosFiltrados = useMemo(() => {
    if (!busquedaEv.trim()) return eventos;
    const q = busquedaEv.toLowerCase();
    return eventos.filter(
      (e) =>
        e.equipo_local.toLowerCase().includes(q) ||
        e.equipo_visitante.toLowerCase().includes(q) ||
        e.liga?.toLowerCase().includes(q),
    );
  }, [eventos, busquedaEv]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

      {/* ── Sub-barra de filtros ─────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 shrink-0">

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <input
            type="text"
            value={busquedaEv}
            onChange={(e) => setBusquedaEv(e.target.value)}
            placeholder="Filtrar por equipo o torneo…"
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

        <span className="text-[#334155] text-xs ml-auto tabular-nums">
          {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Lista de eventos ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">

        {/* Estado: cargando */}
        {cargando && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#10b981]/20 border-t-[#10b981] animate-spin" />
            <span className="text-[#475569] text-sm">Cargando eventos…</span>
          </div>
        )}

        {/* Estado: error */}
        {!cargando && error && (
          <div className="flex items-center gap-2.5 text-[#ef4444] text-sm bg-[#ef4444]/8 border border-[#ef4444]/20 rounded-xl p-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Estado: vacío */}
        {!cargando && !error && eventosFiltrados.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Calendar className="w-10 h-10 text-[#1e293b]" />
            <span className="text-[#334155] text-sm">Sin eventos disponibles</span>
            <span className="text-[#1e293b] text-xs">Prueba con otro deporte o actualiza</span>
          </div>
        )}

        {/* Lista */}
        {!cargando &&
          eventosFiltrados.map((evento) => (
            <TarjetaEvento
              key={evento.id}
              evento={evento}
              modalidades={modalidades}
              seleccionesActivas={seleccionesActivas}
              limiteAlcanzado={limiteAlcanzado}
              onSeleccionar={onSeleccionar}
            />
          ))}
      </div>
    </div>
  );
}