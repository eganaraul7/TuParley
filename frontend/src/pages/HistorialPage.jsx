// Archivo: HistorialPage.jsx
// Ruta: frontend/src/pages/HistorialPage.jsx
// Función: tabla paginada de tickets (bodeguero ve solo los suyos, admin ve todos) con filtros por estado/fecha/serie. 
// Refactorizado en el Paso 6: ModalDetalle y SolicitudAnulacion se movieron a
// components/ticket/ (renombrado a ModalDetalleTicket). El mapa de
// colores BADGE ahora viene de utils/constants.js (antes duplicado).

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, RefreshCw, AlertTriangle,
  Loader2, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { useAuthStore }   from '../store/authStore';
import { ticketsService } from '../services/ticketsService';
import { fmtUsd, fmtBs, fmtCuota, fmtDt } from '../utils/formatters';
import { BADGE_ESTADO_TICKET } from '../utils/constants';
import { ModalDetalleTicket } from '../components/ticket';

const ESTADOS = [
  { key: '',                 label: 'Todos'      },
  { key: 'PENDIENTE',        label: 'Pendiente'  },
  { key: 'GANADO',           label: 'Ganado'     },
  { key: 'PERDIDO',          label: 'Perdido'    },
  { key: 'PAGADO',           label: 'Pagado'     },
  { key: 'ANULADO',          label: 'Anulado'    },
  { key: 'SUSPENDIDO',       label: 'Suspendido' },
  { key: 'CADUCADO_GANADOR', label: 'Caducado'   },
];

const POR_PAGINA = 20;

export default function HistorialPage() {
  const navigate    = useNavigate();
  const { usuario } = useAuthStore((s) => s);
  const esAdmin     = ['computadora_madre', 'administrador'].includes(usuario?.rol);

  const [tickets, setTickets]                       = useState([]);
  const [total, setTotal]                           = useState(0);
  const [pagina, setPagina]                         = useState(1);
  const [cargando, setCargando]                     = useState(false);
  const [error, setError]                           = useState('');
  const [ticketSeleccionado, setTicketSeleccionado]  = useState(null);

  // filtros
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [busqueda, setBusqueda]         = useState('');
  const [fechaDesde, setFechaDesde]     = useState('');
  const [fechaHasta, setFechaHasta]     = useState('');

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const cargar = useCallback(async (pag = 1) => {
    setCargando(true);
    setError('');
    try {
      const params = {
        pagina:      pag,
        limite:      POR_PAGINA,
        estado:      estadoFiltro || undefined,
        serie:       busqueda.trim() || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      };
      const res = await ticketsService.listar(params);
      setTickets(res.tickets ?? []);
      setTotal(res.total ?? 0);
      setPagina(pag);
    } catch {
      setError('No se pudo cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, [estadoFiltro, busqueda, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(1); }, [estadoFiltro, fechaDesde, fechaHasta]);

  function handleBuscar(e) {
    e.preventDefault();
    cargar(1);
  }

  async function handlePagar(ticketId, payload) {
    await ticketsService.pagar(ticketId, payload);
    cargar(pagina);
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f172a] overflow-hidden">

      {/* barra */}
      <header className="h-14 bg-[#1e293b] border-b border-white/5 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-white transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <h1 className="text-white font-bold text-base ml-2">
          {esAdmin ? 'Historial General' : 'Mis Tickets'}
        </h1>
        <div className="flex-1" />
        <span className="text-[#475569] text-xs">
          {total} ticket{total !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => cargar(pagina)}
          disabled={cargando}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-white transition disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* filtros */}
      <div className="bg-[#1e293b] border-b border-white/5 px-4 py-2.5 flex items-center gap-2 shrink-0 flex-wrap">

        <form onSubmit={handleBuscar} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
            placeholder="Serie… B1-1234-5678"
            className="bg-[#0f172a] text-white placeholder-[#475569] text-xs border border-white/10 rounded-lg pl-8 pr-3 py-2 w-48 focus:outline-none focus:border-[#10b981]"
          />
        </form>

        <div className="flex gap-1 flex-wrap">
          {ESTADOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setEstadoFiltro(key); setPagina(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                ${estadoFiltro === key
                  ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#10b981]'
                  : 'bg-[#0f172a] border-white/10 text-[#94a3b8] hover:text-white hover:border-white/20'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="bg-[#0f172a] text-[#94a3b8] text-xs border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-[#10b981]"
          />
          <span className="text-[#475569] text-xs">—</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="bg-[#0f172a] text-[#94a3b8] text-xs border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-[#10b981]"
          />
          {(fechaDesde || fechaHasta) && (
            <button
              onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
              className="text-[#475569] hover:text-white transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* tabla */}
      <div className="flex-1 overflow-y-auto">
        {cargando && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-7 h-7 text-[#10b981] animate-spin" />
          </div>
        )}

        {!cargando && error && (
          <div className="flex items-center gap-2 text-[#ef4444] text-sm m-4 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!cargando && !error && tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <span className="text-4xl">🎫</span>
            <p className="text-[#475569] text-sm">Sin tickets para los filtros seleccionados</p>
          </div>
        )}

        {!cargando && tickets.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[#475569] text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Serie</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                {esAdmin && <th className="px-4 py-3 text-left font-medium">Bodega</th>}
                <th className="px-4 py-3 text-right font-medium">Apostado</th>
                <th className="px-4 py-3 text-right font-medium">Potencial</th>
                <th className="px-4 py-3 text-right font-medium">Cuota</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Moneda</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setTicketSeleccionado(t)}
                  className="border-b border-white/5 hover:bg-white/3 cursor-pointer transition group"
                >
                  <td className="px-4 py-3.5">
                    <span className="text-[#10b981] font-mono text-xs font-medium group-hover:underline">
                      {t.numero_serie}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[#94a3b8] text-xs">{fmtDt(t.fecha_creacion)}</td>
                  {esAdmin && (
                    <td className="px-4 py-3.5 text-[#94a3b8] text-xs">{t.bodega?.nombre ?? '—'}</td>
                  )}
                  <td className="px-4 py-3.5 text-right">
                    <p className="text-white text-xs font-medium">{fmtUsd(t.monto_apostado_usd)}</p>
                    <p className="text-[#475569] text-[11px]">{fmtBs(t.monto_apostado_bs)}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <p className={`text-xs font-bold ${t.estado === 'PERDIDO' ? 'text-[#475569]' : 'text-[#10b981]'}`}>
                      {fmtUsd(t.ganancia_potencial_usd)}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#94a3b8] text-xs">
                    {fmtCuota(t.cuota_combinada)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${BADGE_ESTADO_TICKET[t.estado] ?? ''}`}>
                      {t.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-[#94a3b8] text-xs">{t.moneda_pago}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-[#1e293b] shrink-0">
          <span className="text-[#475569] text-xs">
            Página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => cargar(pagina - 1)}
              disabled={pagina <= 1 || cargando}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-white transition disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => cargar(pagina + 1)}
              disabled={pagina >= totalPaginas || cargando}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-white transition disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {ticketSeleccionado && (
        <ModalDetalleTicket
          ticket={ticketSeleccionado}
          onCerrar={() => setTicketSeleccionado(null)}
          onPagar={handlePagar}
        />
      )}
    </div>
  );
}