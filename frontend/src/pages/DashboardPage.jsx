// Nombre de archivo: DashboardPage.jsx
// Ruta: frontend/src/pages/DashboardPage.jsx
// Función: Dashboard principal del bodeguero. Integra flujo dual de impresión:
//          ModalImpresion elige modo (física/digital), ModalQR muestra el QR.
//          El ticket se crea ANTES de mostrar el selector de modo.
//          Solo muestra categorías activas según configuración del admin.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, AlertTriangle } from 'lucide-react';

import { useAuthStore }    from '../store/authStore';
import { useBcvStore }     from '../store/bcvStore';
import { useSocket }       from '../hooks/useSocket';
import { eventosService }  from '../services/eventosService';
import { ticketsService }  from '../services/ticketsService';
import { printerService }  from '../services/printerService';
import {
  agregarTicket,
  actualizarModoOffline,
} from '../services/offlineQueue';
import { MAX_GANANCIA_USD, APUESTA_MINIMA_USD, DEPORTES } from '../utils/constants';

import { BarraSuperior, NavDeportes, ColumnaEventos } from '../components/bodeguero';
import { TicketSlip, ModalTicket, ModalImpresion, ModalQR } from '../components/ticket';

export default function DashboardPage() {
  const navigate               = useNavigate();
  const { usuario, clearAuth } = useAuthStore((s) => s);
  const tasaBcv                = useBcvStore((s) => s.tasaBcv);

  const [deporteActivo,          setDeporteActivo]          = useState(null);
  const [categoriasActivas,      setCategoriasActivas]      = useState([]);
  const [selecciones,            setSelecciones]            = useState([]);
  const [montoUsd,               setMontoUsd]               = useState(0);
  const [imprimiendo,            setImprimiendo]            = useState(false);
  const [avisoOffline,           setAvisoOffline]           = useState(false);
  const [avisoSinImprimir,       setAvisoSinImprimir]       = useState(false);
  const [serieBuscada,           setSerieBuscada]           = useState('');
  const [contadores,             setContadores]             = useState({});
  const [ticketCreado,           setTicketCreado]           = useState(null);
  const [modalImpresionAbierto,  setModalImpresionAbierto]  = useState(false);
  const [modalQRAbierto,         setModalQRAbierto]         = useState(false);

  useSocket('eventos_actualizados', () => cargarContadores(categoriasActivas));
  useSocket('mantenimiento', ({ activo }) => {
    if (activo) navigate('/login', { replace: true });
  });

  useEffect(() => { cargarContadores(categoriasActivas); }, [categoriasActivas]);

  useEffect(() => {
    if (!avisoOffline) return;
    const t = setTimeout(() => setAvisoOffline(false), 4000);
    return () => clearTimeout(t);
  }, [avisoOffline]);

  useEffect(() => {
    if (!avisoSinImprimir) return;
    const t = setTimeout(() => setAvisoSinImprimir(false), 6000);
    return () => clearTimeout(t);
  }, [avisoSinImprimir]);

  function handleCategoriasListas(activas) {
    setCategoriasActivas(activas);
    // Seleccionar el primer deporte activo por defecto
    if (activas.length > 0) {
      const primero = DEPORTES.find((d) => activas.includes(d.key));
      if (primero) setDeporteActivo(primero.key);
    }
  }

  async function cargarContadores(keys = []) {
    if (keys.length === 0) return;
    try {
      const res = await Promise.allSettled(
        keys.map((dep) => eventosService.listar({ deporte: dep, estado: 'programado' })),
      );
      const map = {};
      keys.forEach((dep, i) => {
        map[dep] = res[i].status === 'fulfilled'
          ? (res[i].value?.total ?? res[i].value?.eventos?.length ?? 0)
          : 0;
      });
      setContadores(map);
    } catch { /* silencioso */ }
  }

  const cuotaCombinada = useMemo(
    () => selecciones.reduce((acc, s) => acc * Number(s.cuota_aplicada), 1),
    [selecciones],
  );

  const gananciaPotencialUsd = useMemo(
    () => (montoUsd > 0 ? montoUsd * cuotaCombinada : 0),
    [montoUsd, cuotaCombinada],
  );

  const limiteAlcanzado = gananciaPotencialUsd >= MAX_GANANCIA_USD;

  function _buildSeleccion(evento, modalidad) {
    return {
      evento_id:        evento.id,
      modalidad_id:     modalidad.id,
      equipos:          `${evento.equipo_local} vs ${evento.equipo_visitante}`,
      modalidad_nombre: modalidad.nombre,
      seleccion:        modalidad.nombre_corto ?? modalidad.nombre,
      cuota_aplicada:   modalidad.cuota_base,
    };
  }

  function handleSeleccionar(evento, modalidad) {
    const yaEnEsteEvento = selecciones.some((s) => s.evento_id === evento.id);
    if (yaEnEsteEvento) {
      const sel = selecciones.find((s) => s.evento_id === evento.id);
      if (sel?.modalidad_id === modalidad.id) {
        setSelecciones((prev) => prev.filter((s) => s.evento_id !== evento.id));
      } else {
        setSelecciones((prev) =>
          prev.map((s) => s.evento_id === evento.id ? _buildSeleccion(evento, modalidad) : s),
        );
      }
      return;
    }
    if (limiteAlcanzado) return;
    setSelecciones((prev) => [...prev, _buildSeleccion(evento, modalidad)]);
  }

  function handleRemover(evento_id) {
    setSelecciones((prev) => prev.filter((s) => s.evento_id !== evento_id));
  }

  function handleLimpiar() {
    setSelecciones([]);
    setMontoUsd(0);
  }

  function _buildPayload(tasa, gananciaUsd, gananciaBs) {
    return {
      selecciones: selecciones.map((s) => ({
        evento_id:      s.evento_id,
        modalidad_id:   s.modalidad_id,
        cuota_aplicada: s.cuota_aplicada,
        seleccion:      s.seleccion,
      })),
      monto_apostado_usd:     montoUsd,
      monto_apostado_bs:      montoUsd * tasa,
      tasa_bcv_dia:           tasa,
      cuota_combinada:        cuotaCombinada,
      ganancia_potencial_usd: gananciaUsd,
      ganancia_potencial_bs:  gananciaBs,
      moneda_pago:            'USD',
    };
  }

  function _normalizarTicket(raw, gananciaUsd, gananciaBs, tasa) {
    return {
      id:                     raw.id       ?? null,
      local_id:               raw.local_id ?? null,
      numero_serie:           raw.numero_serie,
      monto_apostado_usd:     raw.monto_apostado_usd     ?? montoUsd,
      monto_apostado_bs:      raw.monto_apostado_bs      ?? montoUsd * tasa,
      ganancia_potencial_usd: raw.ganancia_potencial_usd ?? gananciaUsd,
      ganancia_potencial_bs:  raw.ganancia_potencial_bs  ?? gananciaBs,
      tasa_bcv_dia:           raw.tasa_bcv_dia           ?? tasa,
      cuota_combinada:        raw.cuota_combinada        ?? cuotaCombinada,
      fecha_creacion:         raw.fecha_creacion,
      selecciones,
    };
  }

  async function handleImprimir() {
    if (selecciones.length === 0 || montoUsd < APUESTA_MINIMA_USD) return;
    setImprimiendo(true);

    const tasa        = Number(tasaBcv) || 1;
    const gananciaUsd = Math.min(gananciaPotencialUsd, MAX_GANANCIA_USD);
    const gananciaBs  = gananciaUsd * tasa;
    const payload     = _buildPayload(tasa, gananciaUsd, gananciaBs);

    try {
      let rawTicket;

      if (!navigator.onLine) {
        rawTicket = await agregarTicket(payload, usuario);
        setAvisoOffline(true);
      } else {
        try {
          const { ticket } = await ticketsService.crear({ ...payload, origen: 'online' });
          rawTicket = ticket;
        } catch (err) {
          if (!err.response) {
            rawTicket = await agregarTicket(payload, usuario);
            setAvisoOffline(true);
          } else {
            console.error('[DashboardPage] crearTicket:', err);
            setImprimiendo(false);
            return;
          }
        }
      }

      setTicketCreado(_normalizarTicket(rawTicket, gananciaUsd, gananciaBs, tasa));
      setModalImpresionAbierto(true);
    } catch (err) {
      console.error('[DashboardPage] handleImprimir:', err);
    } finally {
      setImprimiendo(false);
    }
  }

  function _registrarModo(modo) {
    if (ticketCreado?.id) {
      ticketsService.actualizarModoImpresion(ticketCreado.id, modo).catch(() => {});
    } else if (ticketCreado?.local_id) {
      actualizarModoOffline(ticketCreado.local_id, modo).catch(() => {});
    }
  }

  async function handleModoFisica() {
    setModalImpresionAbierto(false);
    _registrarModo('fisica');

    if (!printerService.estado().conectada) {
      setAvisoSinImprimir(true);
    } else {
      try {
        await printerService.imprimirTicket({ ...ticketCreado, bodega_nombre: usuario?.bodega_nombre });
      } catch {
        setAvisoSinImprimir(true);
      }
    }

    setTicketCreado(null);
    handleLimpiar();
  }

  function handleModoDigital() {
    setModalImpresionAbierto(false);
    _registrarModo('digital');
    setModalQRAbierto(true);
  }

  function handleCerrarModalImpresion() {
    setModalImpresionAbierto(false);
    setTicketCreado(null);
    handleLimpiar();
  }

  function handleCerrarQR() {
    setModalQRAbierto(false);
    setTicketCreado(null);
    handleLimpiar();
  }

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f172a] overflow-hidden">

      <BarraSuperior
        tasaBcv={tasaBcv}
        onBuscarSerie={setSerieBuscada}
        onAbrirHistorial={() => navigate('/historial')}
        onCierreCaja={() => navigate('/cierre-caja')}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 overflow-hidden">
        <NavDeportes
          deporteActivo={deporteActivo}
          contadores={contadores}
          onSeleccionar={setDeporteActivo}
          onCategoriasListas={handleCategoriasListas}
        />
        {deporteActivo && (
          <ColumnaEventos
            deporte={deporteActivo}
            seleccionesActivas={selecciones}
            limiteAlcanzado={limiteAlcanzado}
            onSeleccionar={handleSeleccionar}
          />
        )}
        <TicketSlip
          selecciones={selecciones}
          tasaBcv={tasaBcv}
          montoUsd={montoUsd}
          onCambiarMonto={setMontoUsd}
          onRemoverSeleccion={handleRemover}
          onLimpiar={handleLimpiar}
          onImprimir={handleImprimir}
          imprimiendo={imprimiendo}
        />
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-40">
        {avisoOffline && (
          <div className="bg-[#1e293b] border border-[#f59e0b]/40 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-[#f59e0b] shrink-0" />
            <span className="text-white text-sm font-medium">
              Ticket guardado localmente — se sincronizará al recuperar conexión
            </span>
          </div>
        )}
        {avisoSinImprimir && (
          <div className="bg-[#1e293b] border border-[#ef4444]/40 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0" />
            <span className="text-white text-sm font-medium">
              Ticket guardado pero NO se imprimió — conecta la impresora
            </span>
          </div>
        )}
      </div>

      {serieBuscada && (
        <ModalTicket serie={serieBuscada} onCerrar={() => setSerieBuscada('')} />
      )}

      {modalImpresionAbierto && ticketCreado && (
        <ModalImpresion
          ticket={ticketCreado}
          onFisica={handleModoFisica}
          onDigital={handleModoDigital}
          onClose={handleCerrarModalImpresion}
        />
      )}

      {modalQRAbierto && ticketCreado && (
        <ModalQR
          ticket={ticketCreado}
          onClose={handleCerrarQR}
        />
      )}

    </div>
  );
}