// Archivo: DashboardPage.jsx
// Ruta: frontend/src/pages/DashboardPage.jsx
// Función: pantalla principal del bodeguero — selección de eventos, armado
//          del ticket parlay y registro online/offline. Refactorizado en el
//          Paso 5: los 7 sub-componentes inline se movieron a components/
//          (bodeguero/ y ticket/); aquí solo queda el estado y la lógica
//          de negocio. Fix: se eliminaron 3 imports de íconos muertos
//          (ChevronRight, Menu, Settings) que nunca se usaban.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { useBcvStore  } from '../store/bcvStore';
import { useSocket    } from '../hooks/useSocket';
import { eventosService } from '../services/eventosService';
import { ticketsService } from '../services/ticketsService';
import { agregarTicket  } from '../services/offlineQueue';
import { MAX_GANANCIA_USD, APUESTA_MINIMA_USD } from '../utils/constants';

import { BarraSuperior, NavDeportes, ColumnaEventos } from '../components/bodeguero';
import { TicketSlip, ModalTicket } from '../components/ticket';

export default function DashboardPage() {
  const navigate                = useNavigate();
  const { usuario, clearAuth }  = useAuthStore((s) => s);
  const tasaBcv                 = useBcvStore((s) => s.tasaBcv);

  const [deporteActivo, setDeporteActivo] = useState('futbol');
  const [selecciones, setSelecciones]     = useState([]);
  const [montoUsd, setMontoUsd]           = useState(0);
  const [imprimiendo, setImprimiendo]     = useState(false);
  const [avisoOffline, setAvisoOffline]   = useState(false);
  const [serieBuscada, setSerieBuscada]   = useState('');
  const [contadores, setContadores]       = useState({});

  // Socket: escuchar eventos en tiempo real
  useSocket('eventos_actualizados', cargarContadores);
  useSocket('bcv_actualizada', () => {}); // bcvStore se actualiza internamente
  useSocket('mantenimiento', ({ activo }) => {
    if (activo) navigate('/login', { replace: true });
  });

  useEffect(() => { cargarContadores(); }, []);

  useEffect(() => {
    if (!avisoOffline) return;
    const t = setTimeout(() => setAvisoOffline(false), 4000);
    return () => clearTimeout(t);
  }, [avisoOffline]);

  async function cargarContadores() {
    try {
      // Derivar contadores del listado de eventos disponibles por deporte
      const DEPORTES_KEYS = ['futbol', 'baloncesto', 'beisbol', 'caballos', 'tenis'];
      const resultados = await Promise.allSettled(
        DEPORTES_KEYS.map((dep) => eventosService.listar({ deporte: dep, estado: 'programado' })),
      );
      const map = {};
      DEPORTES_KEYS.forEach((dep, i) => {
        if (resultados[i].status === 'fulfilled') {
          map[dep] = resultados[i].value?.total ?? resultados[i].value?.eventos?.length ?? 0;
        } else {
          map[dep] = 0;
        }
      });
      setContadores(map);
    } catch { /* silencioso */ }
  }

  // ── parlay ────────────────────────────────────────────────────────────────
  const cuotaCombinada = useMemo(
    () => selecciones.reduce((acc, s) => acc * Number(s.cuota_aplicada), 1),
    [selecciones],
  );

  const gananciaPotencialUsd = useMemo(
    () => (montoUsd > 0 ? montoUsd * cuotaCombinada : 0),
    [montoUsd, cuotaCombinada],
  );

  const limiteAlcanzado = gananciaPotencialUsd >= MAX_GANANCIA_USD;

  function handleSeleccionar(evento, modalidad) {
    const yaEstaEnEsteEvento = selecciones.some((s) => s.evento_id === evento.id);

    if (yaEstaEnEsteEvento) {
      // toggle: si es la misma modalidad → quitar, si es diferente → reemplazar
      const selExistente = selecciones.find((s) => s.evento_id === evento.id);
      if (selExistente?.modalidad_id === modalidad.id) {
        setSelecciones((prev) => prev.filter((s) => s.evento_id !== evento.id));
      } else {
        setSelecciones((prev) =>
          prev.map((s) => (s.evento_id === evento.id ? buildSeleccion(evento, modalidad) : s)),
        );
      }
      return;
    }

    if (limiteAlcanzado) return;

    setSelecciones((prev) => [...prev, buildSeleccion(evento, modalidad)]);
  }

  function buildSeleccion(evento, modalidad) {
    return {
      evento_id:        evento.id,
      modalidad_id:     modalidad.id,
      equipos:          `${evento.equipo_local} vs ${evento.equipo_visitante}`,
      modalidad_nombre: modalidad.nombre,
      seleccion:        modalidad.nombre_corto ?? modalidad.nombre,
      cuota_aplicada:   modalidad.cuota_base,
    };
  }

  function handleRemover(evento_id) {
    setSelecciones((prev) => prev.filter((s) => s.evento_id !== evento_id));
  }

  function handleLimpiar() {
    setSelecciones([]);
    setMontoUsd(0);
  }

  async function handleImprimir() {
    if (selecciones.length === 0 || montoUsd < APUESTA_MINIMA_USD) return;
    setImprimiendo(true);

    const tasaActual = Number(tasaBcv) || 1;
    const payload = {
      selecciones: selecciones.map((s) => ({
        evento_id:      s.evento_id,
        modalidad_id:   s.modalidad_id,
        cuota_aplicada: s.cuota_aplicada,
        seleccion:      s.seleccion,
      })),
      monto_apostado_usd: montoUsd,
      monto_apostado_bs:  montoUsd * tasaActual,
      tasa_bcv_dia:       tasaActual,
      cuota_combinada:    cuotaCombinada,
      ganancia_potencial_usd: Math.min(gananciaPotencialUsd, MAX_GANANCIA_USD),
      ganancia_potencial_bs:  Math.min(gananciaPotencialUsd, MAX_GANANCIA_USD) * tasaActual,
      moneda_pago:        'USD',
    };

    // sin conexión → cola local directo, sin tocar la red
    if (!navigator.onLine) {
      try {
        await agregarTicket(payload, usuario);
        setAvisoOffline(true);
        handleLimpiar();
      } catch (err) {
        console.error('Error guardando ticket offline:', err);
      } finally {
        setImprimiendo(false);
      }
      return;
    }

    // con conexión → intentar online; si la red falla a mitad de camino, caer a offline
    try {
      await ticketsService.crear({ ...payload, origen: 'online' });
      handleLimpiar();
    } catch (err) {
      const esErrorDeRed = !err.response; // axios sin response = falló la conexión, no el servidor
      if (esErrorDeRed) {
        try {
          await agregarTicket(payload, usuario);
          setAvisoOffline(true);
          handleLimpiar();
        } catch (errOffline) {
          console.error('Error guardando ticket offline:', errOffline);
        }
      } else {
        console.error('Error creando ticket:', err);
      }
    } finally {
      setImprimiendo(false);
    }
  }

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  // ── render ──────────────────────────────────────────────────────────────────
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
        />

        <ColumnaEventos
          deporte={deporteActivo}
          seleccionesActivas={selecciones}
          limiteAlcanzado={limiteAlcanzado}
          onSeleccionar={handleSeleccionar}
        />

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

      {avisoOffline && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1e293b] border border-[#f59e0b]/40 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-2.5 z-50">
          <WifiOff className="w-4 h-4 text-[#f59e0b] shrink-0" />
          <span className="text-white text-sm font-medium">
            Ticket guardado localmente — se sincronizará al recuperar conexión
          </span>
        </div>
      )}

      {serieBuscada && (
        <ModalTicket serie={serieBuscada} onCerrar={() => setSerieBuscada('')} />
      )}
    </div>
  );
}