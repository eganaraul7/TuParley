// Archivo: BarraSuperior.jsx
// Ruta: frontend/src/components/bodeguero/BarraSuperior.jsx
// Función: barra superior del Dashboard — buscador de ticket, fecha/hora en
//          vivo, tasa BCV, accesos a historial/cierre de caja/logout.
//          Extraído de DashboardPage.jsx (Paso 2 de reorganización components/).
//          Fix: se eliminó estado "buscando" que estaba declarado pero nunca usado.

import { useState, useEffect } from 'react';
import { Search, Clock, History, Wallet, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function BarraSuperior({ tasaBcv, onBuscarSerie, onAbrirHistorial, onCierreCaja, onLogout }) {
  const [ahora, setAhora]       = useState(new Date());
  const [busqueda, setBusqueda] = useState('');
  const { usuario }             = useAuthStore((s) => s);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function handleBuscar(e) {
    e.preventDefault();
    if (busqueda.trim()) { onBuscarSerie(busqueda.trim()); setBusqueda(''); }
  }

  return (
    <header className="h-14 bg-[#1e293b] border-b border-white/5 flex items-center px-4 gap-3 shrink-0">

      {/* logo mínimo */}
      <span className="text-[#10b981] font-bold text-lg tracking-tight mr-2 shrink-0">TP</span>

      {/* buscador serie */}
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

      {/* fecha y hora */}
      <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs shrink-0">
        <Clock className="w-3.5 h-3.5" />
        <span>
          {ahora.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
          {' · '}
          {ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>

      {/* tasa BCV */}
      <div className="bg-[#0f172a] border border-white/10 rounded-lg px-3 py-1.5 text-xs shrink-0">
        <span className="text-[#94a3b8]">BCV </span>
        <span className="text-[#10b981] font-bold">
          {tasaBcv ? `Bs ${Number(tasaBcv).toFixed(2)}` : '---'}
        </span>
        <span className="text-[#475569]"> / $1</span>
      </div>

      {/* historial */}
      <button
        onClick={onAbrirHistorial}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-white hover:border-white/20 transition"
        title="Historial de tickets"
      >
        <History className="w-4 h-4" />
      </button>

      {/* cierre de caja — solo bodeguero */}
      {usuario?.rol === 'bodeguero' && (
        <button
          onClick={onCierreCaja}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-[#10b981] hover:border-[#10b981]/30 transition"
          title="Cierre de caja"
        >
          <Wallet className="w-4 h-4" />
        </button>
      )}

      {/* usuario + logout */}
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