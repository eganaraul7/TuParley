// Archivo: ModalConfirmarContrasena.jsx
// Ruta: frontend/src/components/common/ModalConfirmarContrasena.jsx
// Función: modal de confirmación con contraseña — usado en Cierre de Caja para
//          confirmar el cierre de sesión. Genérico, reutilizable en cualquier
//          flujo que requiera reautenticación rápida.
//          Extraído de CierreCajaPage.jsx (Paso 3 de reorganización components/).
//          Fix: "mostrar" no tenía botón para activarse (el input quedaba
//          fijo en type="password" siempre) — se agregó el toggle Eye/EyeOff,
//          igual al patrón ya usado en LoginPage.

import { useState } from 'react';
import { Lock, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';

export default function ModalConfirmarContrasena({ onConfirmar, onCancelar, cargando, error }) {
  const [contrasena, setContrasena] = useState('');
  const [mostrar, setMostrar]       = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (contrasena.trim()) onConfirmar(contrasena);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-2xl border border-white/10 w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#ef4444]" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Confirmar cierre de sesión</h3>
            <p className="text-[#94a3b8] text-xs">Ingresa tu contraseña para continuar</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={mostrar ? 'text' : 'password'}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              autoFocus
              disabled={cargando}
              className="w-full bg-[#0f172a] text-white placeholder-[#475569] border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white transition"
              tabIndex={-1}
            >
              {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-[#ef4444] text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelar}
              disabled={cargando}
              className="flex-1 py-3 rounded-xl text-sm text-[#94a3b8] hover:text-white border border-white/10 hover:border-white/20 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando || !contrasena.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#ef4444] hover:bg-[#dc2626] text-white transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando
                ? <><Loader2 className="w-4 h-4 animate-spin" />Cerrando…</>
                : 'Terminar sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}