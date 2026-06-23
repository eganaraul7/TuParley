// Archivo: CierreCajaPage.jsx
// Ruta: frontend/src/pages/CierreCajaPage.jsx
// Función: cierre de sesión del bodeguero — resumen calculado por sistema,
//          declaración de montos, preview de discrepancia, confirmación con
//          contraseña. Refactorizado en el Paso 7: KpiCard y
//          ModalConfirmarContrasena se movieron a components/common/.
//          Fix: se eliminaron 3 imports de íconos muertos (TrendingUp,
//          TrendingDown, Calculator) que nunca se usaban.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Loader2, AlertTriangle, CheckCircle, Clock, DollarSign, Ticket } from 'lucide-react';
import { useAuthStore }      from '../store/authStore';
import { cierreCajaService } from '../services/cierreCajaService';
import { authService }       from '../services/authService';
import { fmtUsd, fmtBs, fmtHora } from '../utils/formatters';
import { KpiCard, ModalConfirmarContrasena } from '../components/common';

export default function CierreCajaPage() {
  const navigate               = useNavigate();
  const { usuario, clearAuth } = useAuthStore((s) => s);

  const [resumen, setResumen]   = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');

  // declaración bodeguero
  const [declaradoUsd, setDeclaradoUsd] = useState('');
  const [declaradoBs,  setDeclaradoBs]  = useState('');

  // modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cerrando, setCerrando]         = useState(false);
  const [errorModal, setErrorModal]     = useState('');
  const [cerrado, setCerrado]           = useState(false);

  useEffect(() => { cargarResumen(); }, []);

  async function cargarResumen() {
    setCargando(true);
    setError('');
    try {
      const res = await cierreCajaService.resumen();
      setResumen(res.resumen);
    } catch {
      setError('No se pudo cargar el resumen de caja.');
    } finally {
      setCargando(false);
    }
  }

  // discrepancia calculada en frontend para preview
  const discUsd = resumen
    ? Number(declaradoUsd || 0) - Number(resumen.total_calculado_usd)
    : 0;
  const discBs = resumen
    ? Number(declaradoBs || 0) - Number(resumen.total_calculado_bs)
    : 0;
  const hayDiscrepancia = Math.abs(discUsd) > 0.01 || Math.abs(discBs) > 0.01;

  function handleAbrirModal() {
    if (!declaradoUsd && !declaradoBs) {
      setError('Ingresa los montos recaudados antes de cerrar.');
      return;
    }
    setErrorModal('');
    setModalAbierto(true);
  }

  async function handleCerrar(contrasena) {
    setCerrando(true);
    setErrorModal('');
    try {
      await cierreCajaService.registrar({
        total_usd_declarado: Number(declaradoUsd) || 0,
        total_bs_declarado:  Number(declaradoBs)  || 0,
        contrasena,
      });
      await authService.logout().catch(() => {});
      clearAuth();
      setCerrado(true);
      setModalAbierto(false);
    } catch (err) {
      const msg = err.response?.data?.mensaje ?? 'Error al cerrar sesión.';
      if (msg.toLowerCase().includes('contraseña')) {
        setErrorModal('Contraseña incorrecta.');
      } else {
        setErrorModal(msg);
      }
    } finally {
      setCerrando(false);
    }
  }

  // ── pantalla post-cierre ────────────────────────────────────────────────────
  if (cerrado) {
    return (
      <div className="h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-20 h-20 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-[#10b981]" />
        </div>
        <div className="text-center">
          <h2 className="text-white text-2xl font-bold">Sesión cerrada</h2>
          <p className="text-[#94a3b8] text-sm mt-2">
            Podrás iniciar sesión nuevamente a partir de las 5:00 AM.
          </p>
        </div>
        <div className="bg-[#1e293b] rounded-2xl border border-white/5 px-6 py-4 text-center">
          <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-1">Cierre registrado</p>
          <p className="text-white font-bold">
            {new Date().toLocaleString('es-VE', {
              day: '2-digit', month: 'long',
              hour: '2-digit', minute: '2-digit', hour12: false,
            })}
          </p>
        </div>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="text-[#94a3b8] hover:text-white text-sm transition"
        >
          Ir al login →
        </button>
      </div>
    );
  }

  // ── cargando ────────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
      </div>
    );
  }

  // ── render principal ────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#0f172a] overflow-hidden">

      <header className="h-14 bg-[#1e293b] border-b border-white/5 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-white transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <h1 className="text-white font-bold text-base ml-2">Cierre de Caja</h1>
        <div className="flex-1" />
        {usuario?.hora_apertura_sesion && (
          <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>Sesión iniciada: <span className="text-white">{fmtHora(usuario.hora_apertura_sesion)}</span></span>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {error && (
            <div className="flex items-center gap-2 text-[#ef4444] text-sm bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-4">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {resumen && (
            <>
              <div>
                <h2 className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-3">
                  Resumen del sistema
                </h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <KpiCard icono={Ticket} label="Tickets vendidos" valorPrincipal={resumen.tickets_vendidos} />
                  <KpiCard icono={Ticket} label="Tickets anulados" valorPrincipal={resumen.tickets_anulados} color="text-[#94a3b8]" />
                  <KpiCard icono={DollarSign} label="Premios pagados" valorPrincipal={fmtUsd(resumen.premios_pagados_usd)} color="text-[#ef4444]" />
                  <KpiCard
                    icono={Clock}
                    label="Apertura / Cierre"
                    valorPrincipal={fmtHora(resumen.hora_apertura)}
                    valorSecundario={`Ahora: ${fmtHora(new Date().toISOString())}`}
                  />
                </div>
              </div>

              <div>
                <h2 className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-3">
                  Totales calculados
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f172a] rounded-xl p-5 border border-white/5">
                    <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-2">
                      Total recaudado (sistema)
                    </p>
                    <p className="text-[#10b981] text-3xl font-bold">{fmtUsd(resumen.total_calculado_usd)}</p>
                    <p className="text-[#475569] text-sm mt-1">{fmtBs(resumen.total_calculado_bs)}</p>
                  </div>
                  <div className="bg-[#0f172a] rounded-xl p-5 border border-white/5">
                    <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-2">
                      Ganancia neta estimada
                    </p>
                    <p className="text-white text-3xl font-bold">
                      {fmtUsd(Number(resumen.total_calculado_usd) - Number(resumen.premios_pagados_usd))}
                    </p>
                    <p className="text-[#475569] text-sm mt-1">
                      Apostado − Premios pagados
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <h2 className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-3">
              Tu declaración
            </h2>
            <div className="bg-[#1e293b] rounded-2xl border border-white/5 p-5 space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">
                    Total recaudado en Dólares
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] font-bold text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={declaradoUsd}
                      onChange={(e) => setDeclaradoUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#0f172a] text-white text-right font-bold text-xl border border-white/10 rounded-xl pl-8 pr-4 py-4 focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">
                    Total recaudado en Bolívares
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] font-bold text-xs">Bs</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={declaradoBs}
                      onChange={(e) => setDeclaradoBs(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#0f172a] text-white text-right font-bold text-xl border border-white/10 rounded-xl pl-10 pr-4 py-4 focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]"
                    />
                  </div>
                </div>
              </div>

              {resumen && (declaradoUsd !== '' || declaradoBs !== '') && (
                <div className={`rounded-xl p-4 border ${
                  hayDiscrepancia
                    ? 'bg-[#ef4444]/10 border-[#ef4444]/30'
                    : 'bg-[#10b981]/10 border-[#10b981]/30'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    {hayDiscrepancia
                      ? <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                      : <CheckCircle  className="w-4 h-4 text-[#10b981]" />}
                    <p className={`text-sm font-bold ${hayDiscrepancia ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                      {hayDiscrepancia ? 'Hay discrepancia' : 'Los montos coinciden'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[#94a3b8] mb-0.5">Diferencia USD</p>
                      <p className={`font-bold text-base ${discUsd >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {discUsd >= 0 ? '+' : ''}{fmtUsd(discUsd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94a3b8] mb-0.5">Diferencia Bs</p>
                      <p className={`font-bold text-base ${discBs >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {discBs >= 0 ? '+' : ''}{fmtBs(discBs)}
                      </p>
                    </div>
                  </div>
                  {hayDiscrepancia && (
                    <p className="text-[#ef4444] text-[11px] mt-2">
                      La discrepancia quedará registrada y el administrador recibirá una alerta.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleAbrirModal}
            className="w-full bg-[#ef4444] hover:bg-[#dc2626] active:bg-[#b91c1c] text-white font-bold py-5 rounded-2xl text-lg flex items-center justify-center gap-3 transition shadow-lg shadow-[#ef4444]/20"
          >
            <Lock className="w-5 h-5" />
            Terminar sesión y cerrar caja
          </button>

          <p className="text-center text-[#334155] text-xs">
            Después del cierre no podrás ingresar hasta las 5:00 AM del día siguiente.
          </p>
        </div>
      </div>

      {modalAbierto && (
        <ModalConfirmarContrasena
          onConfirmar={handleCerrar}
          onCancelar={() => { setModalAbierto(false); setErrorModal(''); }}
          cargando={cerrando}
          error={errorModal}
        />
      )}
    </div>
  );
}