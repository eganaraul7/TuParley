// Nombre de archivo: Panel2FA.jsx
// Ruta: frontend/src/components/admin/Panel2FA.jsx
// Función: activación de verificación en dos pasos (TOTP) para la cuenta
//          administradora en sesión. Una vez activa, el login pide el código.

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/authService';
import { mensajeError } from '../../utils/errores';

export default function Panel2FA() {
  const [habilitado, setHabilitado] = useState(null);
  const [setup, setSetup]           = useState(null);   // { secret, otpauth_url }
  const [codigo, setCodigo]         = useState('');
  const [cargando, setCargando]     = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    authService.me()
      .then((r) => setHabilitado(!!r?.usuario?.totp_habilitado))
      .catch(() => setHabilitado(false));
  }, []);

  async function iniciar() {
    setCargando(true); setError('');
    try {
      setSetup(await authService.setup2fa());
    } catch (err) {
      setError(mensajeError(err, 'No se pudo iniciar la configuración.'));
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    setCargando(true); setError('');
    try {
      await authService.confirmarSetup2fa({ codigo_totp: codigo });
      setHabilitado(true);
      setSetup(null);
    } catch (err) {
      setError(mensajeError(err, 'Código incorrecto.'));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="bg-[#0f172a] rounded-xl p-5 border border-white/5 space-y-3">
      <div>
        <p className="text-white text-sm font-bold">Verificación en dos pasos (2FA)</p>
        <p className="text-[#94a3b8] text-xs mt-0.5">
          Pide un código de Google Authenticator (u otra app TOTP) al iniciar sesión con esta cuenta.
        </p>
      </div>

      {habilitado === true && (
        <p className="text-[#10b981] text-xs flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" /> 2FA activo en esta cuenta
        </p>
      )}

      {habilitado === false && !setup && (
        <button
          onClick={iniciar}
          disabled={cargando}
          className="bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Activar 2FA'}
        </button>
      )}

      {setup && (
        <div className="space-y-3">
          <p className="text-[#94a3b8] text-xs">1. Escanea el código con la app de autenticación:</p>
          <div className="bg-white p-3 rounded-lg inline-block">
            <QRCodeSVG value={setup.otpauth_url} size={160} />
          </div>
          <p className="text-[#475569] text-[11px] break-all">
            O ingresa la clave manualmente: <span className="text-white font-mono">{setup.secret}</span>
          </p>
          <p className="text-[#94a3b8] text-xs">2. Escribe el código de 6 dígitos que muestra la app:</p>
          <div className="flex gap-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="w-32 bg-[#1e293b] text-white text-center tracking-widest border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#10b981]"
            />
            <button
              onClick={confirmar}
              disabled={cargando || codigo.length !== 6}
              className="bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-40"
            >
              {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[#ef4444] text-xs">{error}</p>}
    </div>
  );
}
