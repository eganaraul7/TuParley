import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, Wifi } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { rutaPorRol } from '../utils/roles';

const POLL_MS = 15_000; // verificar rol cada 15 s

export default function PendingApprovalPage() {
  const navigate   = useNavigate();
  const { usuario, token, setAuth, clearAuth } = useAuthStore((s) => s);
  const timerRef   = useRef(null);

  // Si por alguna razón llega alguien con rol distinto a 'desconocido', redirigir
  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return; }
    if (usuario?.rol && usuario.rol !== 'desconocido') {
      redirigirPorRol(usuario.rol);
    }
  }, [token, usuario]);

  // Polling: cada POLL_MS consulta /auth/me para detectar cambio de rol
  useEffect(() => {
    if (!token) return;

    async function verificarRol() {
      try {
        const res = await authService.me();
        if (res.usuario.rol !== 'desconocido') {
          setAuth(token, res.usuario);
          redirigirPorRol(res.usuario.rol);
        }
      } catch {
        // token expirado o error → sacar
        clearAuth();
        navigate('/login', { replace: true });
      }
    }

    timerRef.current = setInterval(verificarRol, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [token]);

  function redirigirPorRol(rol) {
    navigate(rutaPorRol(rol), { replace: true });
  }

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6">

      {/* tarjeta */}
      <div className="w-full max-w-sm bg-[#1e293b] rounded-2xl p-10 border border-white/5 shadow-2xl flex flex-col items-center text-center">

        {/* ícono animado */}
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center">
            <Clock className="w-9 h-9 text-[#10b981]" />
          </div>
          {/* pulso */}
          <span className="absolute inset-0 rounded-full border-2 border-[#10b981]/40 animate-ping" />
        </div>

        <h1 className="text-white text-2xl font-bold tracking-tight mb-2">
          Acceso pendiente
        </h1>
        <p className="text-[#94a3b8] text-sm leading-relaxed mb-2">
          Tu cuenta fue creada exitosamente pero aún no tiene un rol asignado.
        </p>
        <p className="text-[#94a3b8] text-sm leading-relaxed mb-8">
          Un administrador revisará tu solicitud y te asignará los permisos correspondientes.
        </p>

        {/* usuario activo */}
        {usuario?.nombre_usuario && (
          <div className="w-full bg-[#0f172a] rounded-xl px-4 py-3 mb-8 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center shrink-0">
              <span className="text-[#10b981] text-xs font-bold uppercase">
                {usuario.nombre_usuario.slice(0, 2)}
              </span>
            </div>
            <div className="text-left min-w-0">
              <p className="text-white text-sm font-medium truncate">{usuario.nombre_usuario}</p>
              <p className="text-[#94a3b8] text-xs">Rol: Desconocido</p>
            </div>
          </div>
        )}

        {/* indicador polling */}
        <div className="flex items-center gap-2 text-[#475569] text-xs mb-8">
          <Wifi className="w-3.5 h-3.5 animate-pulse" />
          <span>Verificando estado automáticamente…</span>
        </div>

        {/* salir */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-[#94a3b8] hover:text-white border border-white/10 hover:border-white/20 rounded-xl py-3 text-sm transition"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>

      <p className="text-[#334155] text-xs mt-6">
        TuParley © {new Date().getFullYear()} — Uso interno exclusivo
      </p>
    </div>
  );
}