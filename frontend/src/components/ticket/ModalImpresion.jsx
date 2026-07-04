// Nombre de archivo: ModalImpresion.jsx
// Ruta: frontend/src/components/ticket/ModalImpresion.jsx
// Función: Modal selector de modo de impresión (física / digital QR).
//          Lee config de la bodega del usuario. Si solo hay un modo activo,
//          lo dispara sin mostrar UI. Si hay dos, presenta la elección.

import { useEffect, useState } from 'react';
import { Printer, QrCode, Loader2, X } from 'lucide-react';
import { bodegaService } from '../../services/bodegaService';
import { useAuthStore } from '../../store/authStore';

export default function ModalImpresion({ ticket, onFisica, onDigital, onClose }) {
  const { usuario }                   = useAuthStore((s) => s);
  const [config,    setConfig]        = useState(null);
  const [cargando,  setCargando]      = useState(true);
  const [error,     setError]         = useState('');

  useEffect(() => {
    cargarConfig();
  }, []);

  async function cargarConfig() {
    setCargando(true);
    setError('');
    try {
      const res = await bodegaService.obtenerConfigImpresion(usuario.bodega_id);
      const cfg = res.config;
      setConfig(cfg);

      // Auto-disparar si solo un modo está activo
      if (cfg.fisica_activa && !cfg.digital_activa) {
        onFisica();
        return;
      }
      if (!cfg.fisica_activa && cfg.digital_activa) {
        onDigital();
        return;
      }
    } catch {
      setError('No se pudo cargar la configuración de impresión.');
    } finally {
      setCargando(false);
    }
  }

  // Si config cargada y solo hay un modo: ya fue auto-disparado arriba,
  // no renderizar nada (el modal se cierra solo en el padre vía callback)
  const soloUnModo = config && ((config.fisica_activa && !config.digital_activa) ||
                                (!config.fisica_activa && config.digital_activa));

  if (!cargando && soloUnModo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-white/10 rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-base">¿Cómo imprimir el ticket?</h2>
            <p className="text-[#475569] text-xs mt-0.5">{ticket?.numero_serie}</p>
          </div>
          <button onClick={onClose} className="text-[#475569] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5">

          {cargando && (
            <div className="flex items-center justify-center py-8 gap-2 text-[#475569]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando configuración…</span>
            </div>
          )}

          {error && (
            <p className="text-[#ef4444] text-sm text-center py-6">{error}</p>
          )}

          {!cargando && !error && config && (
            <div className="grid grid-cols-2 gap-3">

              {/* Física */}
              <button
                onClick={onFisica}
                disabled={!config.fisica_activa}
                className={`flex flex-col items-center justify-center gap-3 p-5 rounded-xl border transition-all
                  ${config.fisica_activa
                    ? 'bg-[#0f172a] border-white/10 hover:border-[#10b981]/50 hover:bg-[#10b981]/5 active:scale-95'
                    : 'bg-[#0f172a]/40 border-white/5 opacity-40 cursor-not-allowed'}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                  ${config.fisica_activa ? 'bg-[#10b981]/15' : 'bg-white/5'}`}>
                  <Printer className={`w-6 h-6 ${config.fisica_activa ? 'text-[#10b981]' : 'text-[#334155]'}`} />
                </div>
                <div className="text-center">
                  <p className="text-white text-sm font-bold">Impresión Física</p>
                  <p className="text-[#475569] text-[11px] mt-0.5">
                    {config.fisica_activa ? 'Impresora térmica' : 'No disponible'}
                  </p>
                </div>
              </button>

              {/* Digital QR */}
              <button
                onClick={onDigital}
                disabled={!config.digital_activa}
                className={`flex flex-col items-center justify-center gap-3 p-5 rounded-xl border transition-all
                  ${config.digital_activa
                    ? 'bg-[#0f172a] border-white/10 hover:border-[#10b981]/50 hover:bg-[#10b981]/5 active:scale-95'
                    : 'bg-[#0f172a]/40 border-white/5 opacity-40 cursor-not-allowed'}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                  ${config.digital_activa ? 'bg-[#10b981]/15' : 'bg-white/5'}`}>
                  <QrCode className={`w-6 h-6 ${config.digital_activa ? 'text-[#10b981]' : 'text-[#334155]'}`} />
                </div>
                <div className="text-center">
                  <p className="text-white text-sm font-bold">Código QR</p>
                  <p className="text-[#475569] text-[11px] mt-0.5">
                    {config.digital_activa ? 'Cliente fotografía QR' : 'No disponible'}
                  </p>
                </div>
              </button>

            </div>
          )}
        </div>

        {/* Footer */}
        {!cargando && !error && config && (
          <div className="px-5 pb-5">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-white/8 text-[#475569] hover:text-white text-sm transition"
            >
              Cancelar
            </button>
          </div>
        )}

      </div>
    </div>
  );
}