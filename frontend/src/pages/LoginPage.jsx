import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { rutaPorRol } from '../utils/roles';

// ─── constantes ────────────────────────────────────────────────────────────────
const STEP = { CREDENTIALS: 'credentials', TOTP: 'totp' };
const MAX_INTENTOS = 5;

// ─── componente principal ──────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate   = useNavigate();
  const setAuth    = useAuthStore((s) => s.setAuth);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const [step, setStep]                         = useState(STEP.CREDENTIALS);
  const [nombreUsuario, setNombreUsuario]       = useState('');
  const [contrasena, setContrasena]             = useState('');
  const [mostrarPass, setMostrarPass]           = useState(false);
  const [codigoTotp, setCodigoTotp]             = useState(['', '', '', '', '', '']);
  const [tempToken, setTempToken]               = useState(null);
  const [error, setError]                       = useState('');
  const [cargando, setCargando]                 = useState(false);
  const [intentosRestantes, setIntentosRestantes] = useState(null);
  const [bloqueado, setBloqueado]               = useState(false);

  const totpRefs = useRef([]);

  useEffect(() => {
    if (isLoggedIn) navigate('/dashboard', { replace: true });
  }, [isLoggedIn, navigate]);

  // ─── helpers ─────────────────────────────────────────────────────────────────
  function limpiarError() { setError(''); }

  // ─── paso 1: credenciales ────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    if (!nombreUsuario.trim() || !contrasena.trim()) {
      setError('Completa usuario y contraseña.');
      return;
    }
    setCargando(true);
    limpiarError();

    try {
      const res = await authService.login({
        nombre_usuario: nombreUsuario.trim(),
        contrasena,
      });

      if (!res.requiere_2fa) {
        setAuth(res.token, res.usuario);
        navigate(rutaPorRol(res.usuario.rol), { replace: true });
        return;
      }

      // admin → requiere TOTP
      setTempToken(res.temp_token);
      setStep(STEP.TOTP);
    } catch (err) {
      const data        = err.response?.data ?? {};
      const restantes   = data.intentos_restantes;
      const esBloqueado = data.bloqueado;

      if (esBloqueado) {
        setBloqueado(true);
        setError('Cuenta bloqueada. Contacta al administrador.');
      } else {
        if (typeof restantes === 'number') setIntentosRestantes(restantes);
        setError(data.mensaje || 'Error de conexión.');
      }
    } finally {
      setCargando(false);
    }
  }

  // ─── paso 2: TOTP ────────────────────────────────────────────────────────────
  function handleTotpChange(valor, idx) {
    const digito = valor.replace(/\D/g, '').slice(-1);
    const nuevo  = [...codigoTotp];
    nuevo[idx]   = digito;
    setCodigoTotp(nuevo);
    if (digito && idx < 5) totpRefs.current[idx + 1]?.focus();
    if (nuevo.every((d) => d !== '')) verificarTotp(nuevo.join(''));
  }

  function handleTotpKeyDown(e, idx) {
    if (e.key === 'Backspace' && !codigoTotp[idx] && idx > 0) {
      totpRefs.current[idx - 1]?.focus();
    }
  }

  function handleTotpPaste(e) {
    e.preventDefault();
    const pegado = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pegado.length === 6) {
      setCodigoTotp(pegado.split(''));
      verificarTotp(pegado);
    }
  }

  async function verificarTotp(codigo) {
    if (codigo.length !== 6) return;
    setCargando(true);
    limpiarError();

    try {
      const res = await authService.verify2fa({
        temp_token:  tempToken,
        codigo_totp: codigo,
      });
      setAuth(res.token, res.usuario);
      navigate(rutaPorRol(res.usuario.rol), { replace: true });
    } catch (err) {
      const msg = err.response?.data?.mensaje || 'Código incorrecto.';
      setError(msg);
      setCodigoTotp(['', '', '', '', '', '']);
      totpRefs.current[0]?.focus();
    } finally {
      setCargando(false);
    }
  }

  function volverACredenciales() {
    setStep(STEP.CREDENTIALS);
    setTempToken(null);
    setCodigoTotp(['', '', '', '', '', '']);
    limpiarError();
  }

  // ─── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* ── Logo ── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1e293b] mb-4 border border-[#10b981]/30">
            <span className="text-[#10b981] font-bold text-2xl tracking-tight">TP</span>
          </div>
          <h1 className="text-white text-3xl font-bold tracking-tight">TuParley</h1>
          <p className="text-[#94a3b8] text-sm mt-1">Sistema de Apuestas Deportivas</p>
        </div>

        {/* ── Panel ── */}
        <div className="bg-[#1e293b] rounded-2xl p-8 shadow-2xl border border-white/5">

          {/* STEP: CREDENCIALES */}
          {step === STEP.CREDENTIALS && (
            <>
              <h2 className="text-white text-xl font-semibold mb-6">
                {bloqueado ? 'Cuenta bloqueada' : 'Iniciar sesión'}
              </h2>

              {bloqueado ? (
                <div className="flex items-start gap-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-4">
                  <AlertCircle className="text-[#ef4444] w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[#ef4444] text-sm font-medium">Acceso bloqueado</p>
                    <p className="text-[#94a3b8] text-xs mt-0.5">
                      Tu cuenta fue bloqueada por múltiples intentos fallidos.
                      Contacta al administrador para desbloquearla.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4" noValidate>

                  {/* usuario */}
                  <div>
                    <label className="block text-[#94a3b8] text-xs font-medium mb-1.5 uppercase tracking-wider">
                      Usuario
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                      <input
                        type="text"
                        value={nombreUsuario}
                        onChange={(e) => { setNombreUsuario(e.target.value); limpiarError(); }}
                        placeholder="nombre_usuario"
                        autoComplete="username"
                        autoFocus
                        disabled={cargando}
                        className="w-full bg-[#0f172a] text-white placeholder-[#475569] border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* contraseña */}
                  <div>
                    <label className="block text-[#94a3b8] text-xs font-medium mb-1.5 uppercase tracking-wider">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                      <input
                        type={mostrarPass ? 'text' : 'password'}
                        value={contrasena}
                        onChange={(e) => { setContrasena(e.target.value); limpiarError(); }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={cargando}
                        className="w-full bg-[#0f172a] text-white placeholder-[#475569] border border-white/10 rounded-xl pl-10 pr-12 py-3.5 text-sm focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPass((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white transition"
                        tabIndex={-1}
                      >
                        {mostrarPass
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye    className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* error */}
                  {error && (
                    <div className="flex items-center gap-2 text-[#ef4444] text-sm bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* intentos restantes */}
                  {intentosRestantes !== null && intentosRestantes < MAX_INTENTOS && !bloqueado && (
                    <p className="text-[#94a3b8] text-xs text-center">
                      Intentos restantes:{' '}
                      <span className={intentosRestantes <= 2 ? 'text-[#ef4444] font-bold' : 'text-white font-medium'}>
                        {intentosRestantes}
                      </span>
                      {' '}de {MAX_INTENTOS}
                    </p>
                  )}

                  {/* submit */}
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white font-semibold py-3.5 rounded-xl transition duration-150 flex items-center justify-center gap-2 text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cargando
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Verificando...</>
                      : 'Ingresar'}
                  </button>
                </form>
              )}
            </>
          )}

          {/* STEP: TOTP */}
          {step === STEP.TOTP && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#10b981]" />
                </div>
                <div>
                  <h2 className="text-white text-xl font-semibold">Autenticación 2FA</h2>
                  <p className="text-[#94a3b8] text-xs">Código de Google Authenticator</p>
                </div>
              </div>

              {/* dígitos */}
              <div
                className="flex gap-2 justify-center mb-4"
                onPaste={handleTotpPaste}
              >
                {codigoTotp.map((digito, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { totpRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digito}
                    onChange={(e) => handleTotpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleTotpKeyDown(e, idx)}
                    disabled={cargando}
                    autoFocus={idx === 0}
                    className="w-11 h-14 bg-[#0f172a] text-white text-center text-xl font-bold border border-white/10 rounded-xl focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition disabled:opacity-50 caret-transparent"
                  />
                ))}
              </div>

              {cargando && (
                <div className="flex justify-center mb-4">
                  <Loader2 className="w-5 h-5 text-[#10b981] animate-spin" />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-[#ef4444] text-sm bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={volverACredenciales}
                disabled={cargando}
                className="w-full text-[#94a3b8] hover:text-white text-sm py-2.5 rounded-xl border border-white/10 hover:border-white/20 transition disabled:opacity-50"
              >
                ← Volver
              </button>
            </>
          )}
        </div>

        {/* footer */}
        <p className="text-center text-[#475569] text-xs mt-6">
          TuParley © {new Date().getFullYear()} — Uso interno exclusivo
        </p>
      </div>
    </div>
  );
}