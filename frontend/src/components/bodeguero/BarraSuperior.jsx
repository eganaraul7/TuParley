// Nombre de archivo: BarraSuperior.jsx
// Ruta: frontend/src/components/bodeguero/BarraSuperior.jsx
// Función: Barra superior del Dashboard. Logo TuParley, buscador por número de
//          serie, reloj VE, tasa BCV, conexión impresora, accesos rápidos.

import { useState, useEffect } from 'react';
import { Search, Clock, History, Wallet, LogOut, Printer, Usb, Bluetooth, Unlink } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { printerService } from '../../services/printerService';

export default function BarraSuperior({
  tasaBcv,
  onBuscarSerie,
  onAbrirHistorial,
  onCierreCaja,
  onLogout,
}) {
  const [ahora,                setAhora]                = useState(new Date());
  const [busqueda,             setBusqueda]             = useState('');
  const [estadoImpresora,      setEstadoImpresora]      = useState(() => printerService.estado());
  const [menuImpresoraAbierto, setMenuImpresoraAbierto] = useState(false);
  const { usuario } = useAuthStore((s) => s);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
      setMenuImpresoraAbierto(false);
    }
  }

  async function handleConectarBluetooth() {
    try {
      await printerService.conectarBluetooth();
      setEstadoImpresora(printerService.estado());
    } catch (err) {
      alert(err.message ?? 'No se pudo conectar la impresora Bluetooth.');
    } finally {
      setMenuImpresoraAbierto(false);
    }
  }

  async function handleDesconectarImpresora() {
    await printerService.desconectar();
    setEstadoImpresora(printerService.estado());
    setMenuImpresoraAbierto(false);
  }

  return (
    <header className="h-14 bg-[#1e293b] border-b border-white/5 flex items-center px-4 gap-3 shrink-0">

      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-2 shrink-0">
        <span className="w-6 h-6 rounded-md bg-[#10b981] flex items-center justify-center text-white text-[11px] font-black">
          TP
        </span>
        <span className="text-white text-sm font-bold hidden lg:block">TuParley</span>
      </div>

      {/* Buscador de ticket */}
      <form onSubmit={handleBuscar} className="flex-1 max-w-xs relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#334155]" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
          placeholder="Buscar ticket… B1-1234-5678"
          className="w-full bg-[#0f172a] text-white placeholder-[#334155] text-xs border border-white/8 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-[#10b981] transition"
        />
      </form>

      <div className="flex-1" />

      {/* Reloj */}
      <div className="flex items-center gap-1.5 text-[#475569] text-xs shrink-0">
        <Clock className="w-3.5 h-3.5" />
        <span className="tabular-nums">
          {ahora.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
          {' · '}
          {ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>

      {/* Tasa BCV */}
      <div className="bg-[#0f172a] border border-white/8 rounded-lg px-3 py-1.5 text-xs shrink-0">
        <span className="text-[#475569]">BCV </span>
        <span className="text-[#10b981] font-black">
          {tasaBcv ? `Bs ${Number(tasaBcv).toFixed(2)}` : '---'}
        </span>
        <span className="text-[#334155]"> / $1</span>
      </div>

      {/* Impresora */}
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuImpresoraAbierto((v) => !v)}
          title={estadoImpresora.conectada ? `Impresora: ${estadoImpresora.nombre}` : 'Conectar impresora'}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition
            ${estadoImpresora.conectada
              ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#10b981]'
              : 'bg-[#0f172a] border-white/8 text-[#475569] hover:text-white hover:border-white/20'}`}
        >
          <Printer className="w-4 h-4" />
        </button>

        {menuImpresoraAbierto && (
          <div className="absolute right-0 top-11 w-52 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl p-2 z-50 space-y-1">
            <p className="text-[#334155] text-[11px] px-2 pb-1 border-b border-white/5">
              {estadoImpresora.conectada ? `✓ ${estadoImpresora.nombre}` : 'Sin impresora'}
            </p>
            <button
              onClick={handleConectarUSB}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-[#94a3b8] hover:text-white hover:bg-white/5 transition"
            >
              <Usb className="w-3.5 h-3.5" /> Conectar USB
            </button>
            <button
              onClick={handleConectarBluetooth}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-[#94a3b8] hover:text-white hover:bg-white/5 transition"
            >
              <Bluetooth className="w-3.5 h-3.5" /> Conectar Bluetooth
            </button>
            {estadoImpresora.conectada && (
              <button
                onClick={handleDesconectarImpresora}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition"
              >
                <Unlink className="w-3.5 h-3.5" /> Desconectar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Historial */}
      <button
        onClick={onAbrirHistorial}
        title="Historial de tickets"
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/8 text-[#475569] hover:text-white hover:border-white/20 transition"
      >
        <History className="w-4 h-4" />
      </button>

      {/* Cierre de caja (solo bodeguero) */}
      {usuario?.rol === 'bodeguero' && (
        <button
          onClick={onCierreCaja}
          title="Cierre de caja"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/8 text-[#475569] hover:text-[#10b981] hover:border-[#10b981]/30 transition"
        >
          <Wallet className="w-4 h-4" />
        </button>
      )}

      {/* Usuario + logout */}
      <div className="flex items-center gap-2">
        <span className="text-[#334155] text-xs hidden lg:block">{usuario?.nombre_usuario}</span>
        <button
          onClick={onLogout}
          title="Cerrar sesión"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/8 text-[#475569] hover:text-[#ef4444] hover:border-[#ef4444]/30 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}