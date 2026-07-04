// Nombre de archivo: BarraSuperior.jsx
// Ruta: frontend/src/components/bodeguero/BarraSuperior.jsx
// Función: Barra superior del Dashboard. Logo TuParley, buscador por número de
//          serie, reloj VE, tasa BCV, conexión impresora, accesos rápidos.

import { useState, useEffect } from 'react';
import { Search, Clock, History, Wallet, LogOut,
          Printer, Usb, Bluetooth, Unlink, QrCode, Loader2 } from 'lucide-react';
import { useAuthStore }   from '../../store/authStore';
import { printerService } from '../../services/printerService';
import { bodegaService }  from '../../services/bodegaService';

function MiniToggle({ activo, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-8 h-4 rounded-full transition-colors shrink-0 disabled:opacity-40
        ${activo ? 'bg-[#10b981]' : 'bg-[#1e293b] border border-white/15'}`}
    >
      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
        ${activo ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

export default function BarraSuperior({ tasaBcv, onBuscarSerie, onAbrirHistorial, onCierreCaja, onLogout }) {
  const [ahora,                setAhora]                = useState(new Date());
  const [busqueda,             setBusqueda]             = useState('');
  const [estadoImpresora,      setEstadoImpresora]      = useState(() => printerService.estado());
  const [menuAbierto,          setMenuAbierto]          = useState(false);
  const [configImpresion,      setConfigImpresion]      = useState({ fisica_activa: 1, digital_activa: 1 });
  const [cargandoConfig,       setCargandoConfig]       = useState(false);
  const [guardandoConfig,      setGuardandoConfig]      = useState(null);  // 'fisica'|'digital'|null
  const { usuario }            = useAuthStore((s) => s);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearTimeout(t);
  }, []);

  // Cargar config al abrir el menú (lazy — no bloquea el render inicial)
  useEffect(() => {
    if (!menuAbierto || !usuario?.bodega_id) return;
    setCargandoConfig(true);
    bodegaService.obtenerConfigImpresion(usuario.bodega_id)
      .then(({ config }) => setConfigImpresion(config))
      .catch(() => {})
      .finally(() => setCargandoConfig(false));
  }, [menuAbierto]);

  function handleBuscar(e) {
    e.preventDefault();
    if (busqueda.trim()) { onBuscarSerie(busqueda.trim()); setBusqueda(''); }
  }

  async function handleConectarUSB() {
    try {
      await printerService.conectarUSB();
      setEstadoImpresora(printerService.estado());
    } catch (err) {
      alert(err.message ?? 'No se pudo conectar la impresora USB.');
    } finally {
      setMenuAbierto(false);
    }
  }

  async function handleConectarBluetooth() {
    try {
      await printerService.conectarBluetooth();
      setEstadoImpresora(printerService.estado());
    } catch (err) {
      alert(err.message ?? 'No se pudo conectar la impresora Bluetooth.');
    } finally {
      setMenuAbierto(false);
    }
  }

  async function handleDesconectar() {
    await printerService.desconectar();
    setEstadoImpresora(printerService.estado());
    setMenuAbierto(false);
  }

  async function handleToggleModo(campo) {
    if (!usuario?.bodega_id || guardandoConfig) return;

    const esActivo    = campo === 'fisica_activa' ? configImpresion.fisica_activa : configImpresion.digital_activa;
    const otroCampo   = campo === 'fisica_activa' ? 'digital_activa' : 'fisica_activa';
    const otroActivo  = configImpresion[otroCampo];

    // Validar: no dejar ambos en 0
    if (esActivo && !otroActivo) return;

    // Optimistic update
    setConfigImpresion((prev) => ({ ...prev, [campo]: !esActivo }));
    setGuardandoConfig(campo);

    try {
      await bodegaService.actualizarConfigImpresion(usuario.bodega_id, { [campo]: !esActivo });
    } catch {
      // Revertir
      setConfigImpresion((prev) => ({ ...prev, [campo]: esActivo }));
    } finally {
      setGuardandoConfig(null);
    }
  }

  const ambosBloqueados =
    !configImpresion.fisica_activa && !configImpresion.digital_activa;

  return (
    <header className="h-14 bg-[#1e293b] border-b border-white/5 flex items-center px-4 gap-3 shrink-0">

      <span className="text-[#10b981] font-bold text-lg tracking-tight mr-2 shrink-0">TP</span>

      <form onSubmit={handleBuscar} className="flex-1 max-w-xs relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
          placeholder="Buscar ticket… ej. B1-1234-5678"
          className="w-full bg-[#0f172a] text-white placeholder-[#475569] text-xs border border-white/10 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-[#10b981]"
        />
      </form>

      <div className="flex-1" />

      {/* Reloj */}
      <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs shrink-0">
        <Clock className="w-3.5 h-3.5" />
        <span>
          {ahora.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
          {' · '}
          {ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>

      {/* BCV */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg px-3 py-1.5 text-xs shrink-0">
        <span className="text-[#94a3b8]">BCV </span>
        <span className="text-[#10b981] font-bold">
          {tasaBcv ? `Bs ${Number(tasaBcv).toFixed(2)}` : '---'}
        </span>
        <span className="text-[#475569]"> / $1</span>
      </div>

      {/* Impresora + config modo */}
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuAbierto((v) => !v)}
          title={estadoImpresora.conectada ? `Impresora: ${estadoImpresora.nombre}` : 'Impresora / Modo impresión'}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition
            ${estadoImpresora.conectada
              ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#10b981]'
              : 'bg-[#0f172a] border-white/10 text-[#94a3b8] hover:text-white hover:border-white/20'}`}
        >
          <Printer className="w-4 h-4" />
        </button>

        {menuAbierto && (
          <div className="absolute right-0 top-11 w-56 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl p-2 z-50 space-y-1">

            {/* ── Conexión ─────────────────────────────────────── */}
            <p className="text-[#334155] text-[10px] uppercase tracking-wider font-semibold px-2 pt-1">
              Conexión
            </p>
            <p className="text-[#475569] text-[11px] px-2 pb-0.5">
              {estadoImpresora.conectada ? `✓ ${estadoImpresora.nombre}` : 'Sin impresora'}
            </p>

            <button
              onClick={handleConectarUSB}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-white hover:bg-white/5 transition"
            >
              <Usb className="w-3.5 h-3.5 text-[#94a3b8]" /> Conectar USB
            </button>
            <button
              onClick={handleConectarBluetooth}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-white hover:bg-white/5 transition"
            >
              <Bluetooth className="w-3.5 h-3.5 text-[#94a3b8]" /> Conectar Bluetooth
            </button>
            {estadoImpresora.conectada && (
              <button
                onClick={handleDesconectar}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition"
              >
                <Unlink className="w-3.5 h-3.5" /> Desconectar
              </button>
            )}

            {/* ── Modo impresión ───────────────────────────────── */}
            <div className="border-t border-white/5 mt-1 pt-1">
              <p className="text-[#334155] text-[10px] uppercase tracking-wider font-semibold px-2 py-1">
                Modo de impresión
              </p>

              {cargandoConfig ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 text-[#475569] animate-spin" />
                </div>
              ) : (
                <div className="space-y-1 px-1">

                  {/* Física */}
                  <div className={`flex items-center justify-between px-2 py-2 rounded-lg
                    ${configImpresion.fisica_activa ? 'bg-white/3' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Printer className="w-3.5 h-3.5 text-[#475569]" />
                      <span className={`text-xs ${configImpresion.fisica_activa ? 'text-white' : 'text-[#334155]'}`}>
                        Física
                      </span>
                    </div>
                    {guardandoConfig === 'fisica_activa'
                      ? <Loader2 className="w-3.5 h-3.5 text-[#475569] animate-spin" />
                      : <MiniToggle
                          activo={!!configImpresion.fisica_activa}
                          onChange={() => handleToggleModo('fisica_activa')}
                          disabled={!!guardandoConfig || (!!configImpresion.fisica_activa && !configImpresion.digital_activa)}
                        />}
                  </div>

                  {/* Digital QR */}
                  <div className={`flex items-center justify-between px-2 py-2 rounded-lg
                    ${configImpresion.digital_activa ? 'bg-white/3' : ''}`}>
                    <div className="flex items-center gap-2">
                      <QrCode className="w-3.5 h-3.5 text-[#475569]" />
                      <span className={`text-xs ${configImpresion.digital_activa ? 'text-white' : 'text-[#334155]'}`}>
                        QR Digital
                      </span>
                    </div>
                    {guardandoConfig === 'digital_activa'
                      ? <Loader2 className="w-3.5 h-3.5 text-[#475569] animate-spin" />
                      : <MiniToggle
                          activo={!!configImpresion.digital_activa}
                          onChange={() => handleToggleModo('digital_activa')}
                          disabled={!!guardandoConfig || (!configImpresion.fisica_activa && !!configImpresion.digital_activa)}
                        />}
                  </div>

                  {ambosBloqueados && (
                    <p className="text-[#ef4444] text-[10px] px-2 pb-1">
                      Al menos uno debe estar activo
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Historial */}
      <button
        onClick={onAbrirHistorial}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-white hover:border-white/20 transition"
        title="Historial de tickets"
      >
        <History className="w-4 h-4" />
      </button>

      {/* Cierre caja */}
      {usuario?.rol === 'bodeguero' && (
        <button
          onClick={onCierreCaja}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-[#10b981] hover:border-[#10b981]/30 transition"
          title="Cierre de caja"
        >
          <Wallet className="w-4 h-4" />
        </button>
      )}

      {/* Usuario + logout */}
      <div className="flex items-center gap-2">
        <span className="text-[#94a3b8] text-xs hidden sm:block">{usuario?.nombre_usuario}</span>
        <button
          onClick={onLogout}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-[#ef4444] hover:border-[#ef4444]/30 transition"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}