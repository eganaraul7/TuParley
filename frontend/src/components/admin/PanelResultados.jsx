// Nombre de archivo: PanelResultados.jsx
// Ruta: frontend/src/components/admin/PanelResultados.jsx
// Función: Admin — eventos que esperan resultado (tenis, MMA, o cuando la API
//          no lo trae). Registrar el resultado liquida los tickets; suspender
//          deja los tickets en SUSPENDIDO para devolución.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { eventosService } from '../../services/eventosService';
import { fmtDt } from '../../utils/formatters';
import { mensajeError } from '../../utils/errores';

const DETALLES = {
  futbol: [['', 'Tiempo reglamentario'], ['tiempo_extra', 'Tiempo extra'], ['penales', 'Penales']],
  mma:    [['', 'Método desconocido'], ['ko', 'KO'], ['tko', 'TKO'], ['sumision', 'Sumisión'], ['decision', 'Decisión']],
};
const AYUDA_MARCADOR = {
  futbol:     'Goles al final de los 90 minutos',
  baloncesto: 'Puntos finales',
  beisbol:    'Carreras finales',
  tenis:      'Sets ganados por cada jugador',
};

function FilaEvento({ evento, onListo }) {
  const usaMarcador = evento.deporte !== 'mma';
  const [ml, setMl]           = useState('');
  const [mv, setMv]           = useState('');
  const [ganador, setGanador] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg]         = useState(null);

  async function guardar() {
    setEnviando(true); setMsg(null);
    try {
      const payload = usaMarcador
        ? { marcador_local: ml, marcador_visitante: mv, detalle_fin: detalle || null }
        : { ganador, detalle_fin: detalle || null };
      const res = await eventosService.registrarResultado(evento.id, payload);
      const l = res.liquidacion ?? {};
      setMsg({ ok: true, texto: `Liquidadas ${l.resueltas ?? 0} selecciones${l.sinDatos ? ` · ${l.sinDatos} siguen sin datos` : ''}` });
      onListo();
    } catch (err) {
      setMsg({ ok: false, texto: mensajeError(err, 'No se pudo registrar el resultado.') });
    } finally {
      setEnviando(false);
    }
  }

  async function suspender() {
    if (!window.confirm('¿Suspender este evento? Los tickets pendientes quedarán SUSPENDIDOS para devolución.')) return;
    setEnviando(true); setMsg(null);
    try {
      await eventosService.actualizar(evento.id, { estado: 'suspendido' });
      onListo();
    } catch (err) {
      setMsg({ ok: false, texto: mensajeError(err, 'No se pudo suspender.') });
    } finally {
      setEnviando(false);
    }
  }

  const input = 'w-14 bg-[#0f172a] text-white text-sm text-center border border-white/10 rounded-lg py-1.5 focus:outline-none focus:border-[#10b981]';
  const select = 'bg-[#0f172a] text-white text-xs border border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#10b981]';

  return (
    <div className="bg-[#0f172a] rounded-xl px-4 py-3 border border-white/5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white text-xs font-semibold truncate">{evento.equipo_local} vs {evento.equipo_visitante}</p>
          <p className="text-[#475569] text-[10px] capitalize">
            {evento.deporte} · {evento.liga} · {fmtDt(evento.fecha_inicio)} · {evento.estado}
          </p>
        </div>
        <span className="text-[#f59e0b] text-[10px] font-bold shrink-0">
          {evento.selecciones_pendientes} apuesta{Number(evento.selecciones_pendientes) !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {usaMarcador ? (
          <>
            <input type="number" min="0" value={ml} onChange={(e) => setMl(e.target.value)} className={input} aria-label="Marcador local" />
            <span className="text-[#475569] text-xs">-</span>
            <input type="number" min="0" value={mv} onChange={(e) => setMv(e.target.value)} className={input} aria-label="Marcador visitante" />
            <span className="text-[#475569] text-[10px]">{AYUDA_MARCADOR[evento.deporte]}</span>
          </>
        ) : (
          <select value={ganador} onChange={(e) => setGanador(e.target.value)} className={select}>
            <option value="">Ganador…</option>
            <option value="local">{evento.equipo_local}</option>
            <option value="visitante">{evento.equipo_visitante}</option>
            <option value="empate">Empate / sin decisión</option>
          </select>
        )}
        {DETALLES[evento.deporte] && (
          <select value={detalle} onChange={(e) => setDetalle(e.target.value)} className={select}>
            {DETALLES[evento.deporte].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <button
          onClick={guardar}
          disabled={enviando || (usaMarcador ? ml === '' || mv === '' : !ganador)}
          className="bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-40"
        >
          {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Registrar'}
        </button>
        <button
          onClick={suspender}
          disabled={enviando}
          className="text-[#f59e0b] text-xs font-semibold px-2 py-1.5 rounded-lg border border-[#f59e0b]/30 hover:bg-[#f59e0b]/10 transition disabled:opacity-40"
        >
          Suspender
        </button>
      </div>

      {msg && (
        <p className={`text-[11px] flex items-center gap-1 ${msg.ok ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
          {msg.ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {msg.texto}
        </p>
      )}
    </div>
  );
}

export default function PanelResultados() {
  const [eventos, setEventos]   = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const res = await eventosService.pendientesResultado();
      setEventos(res.eventos ?? []);
    } catch (err) {
      setError(mensajeError(err, 'Error cargando eventos pendientes.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[#475569] text-[11px]">
          Eventos que terminaron y esperan resultado para liquidar sus tickets.
        </p>
        <button onClick={cargar} disabled={cargando} className="text-[#94a3b8] hover:text-white transition disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error && <p className="text-[#ef4444] text-xs">{error}</p>}
      {!cargando && !error && eventos.length === 0 && (
        <p className="text-[#334155] text-xs text-center py-6">No hay eventos pendientes de resultado</p>
      )}
      {eventos.map((ev) => <FilaEvento key={ev.id} evento={ev} onListo={cargar} />)}
    </div>
  );
}
