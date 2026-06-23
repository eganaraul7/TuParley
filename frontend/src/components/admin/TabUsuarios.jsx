// Archivo: TabUsuarios.jsx
// Ruta: frontend/src/components/admin/TabUsuarios.jsx
// Función: tab del panel admin — gestión de usuarios (rol, bloqueo, eliminar)
//          y aprobación de solicitudes de reingreso. Extraído de AdminPage.jsx
//          (Paso 4). Fix: se eliminó estado "editando" declarado sin uso.

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, ShieldCheck, Lock, Unlock, Trash2, Loader2 } from 'lucide-react';
import { usuariosService } from '../../services/usuariosService';
import { fmtDt } from '../../utils/formatters';
import ModalCrearUsuario from './ModalCrearUsuario';

const ROLES_ASIGNABLES = ['administrador', 'bodeguero', 'desconocido'];

export default function TabUsuarios() {
  const [usuarios, setUsuarios]     = useState([]);
  const [cargando, setCargando]     = useState(false);
  const [error, setError]           = useState('');
  const [modalCrear, setModalCrear] = useState(false);
  const [reingreso, setReingreso]   = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [uRes, rRes] = await Promise.all([
        usuariosService.listar(),
        usuariosService.solicitudesReingreso(),
      ]);
      setUsuarios(uRes.usuarios ?? []);
      setReingreso(rRes.solicitudes ?? []);
    } catch { setError('Error cargando usuarios.'); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, []);

  async function toggleBloqueo(u) {
    try {
      if (u.bloqueado) await usuariosService.desbloquear(u.id);
      else             await usuariosService.bloquear(u.id);
      cargar();
    } catch { setError('No se pudo cambiar el bloqueo.'); }
  }

  async function cambiarRol(id, rol) {
    try { await usuariosService.cambiarRol(id, rol); cargar(); }
    catch { setError('No se pudo cambiar el rol.'); }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar usuario?')) return;
    try { await usuariosService.eliminar(id); cargar(); }
    catch { setError('No se pudo eliminar.'); }
  }

  async function responderReingreso(id, aprobar) {
    try {
      await usuariosService.responderReingreso(id, aprobar ? 'aprobada' : 'rechazada');
      cargar();
    } catch { setError('Error al responder solicitud.'); }
  }

  return (
    <div className="space-y-4">
      {/* solicitudes reingreso */}
      {reingreso.filter((r) => r.estado === 'pendiente').length > 0 && (
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl p-4">
          <p className="text-[#f59e0b] text-xs font-bold uppercase tracking-wider mb-3">
            Solicitudes de reingreso pendientes
          </p>
          {reingreso.filter((r) => r.estado === 'pendiente').map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-t border-white/5 first:border-0">
              <div>
                <p className="text-white text-sm font-medium">{r.usuario?.nombre_usuario}</p>
                <p className="text-[#94a3b8] text-xs">Solicitud: {fmtDt(r.hora_solicitud)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => responderReingreso(r.id, true)}
                  className="px-3 py-1.5 bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] rounded-lg text-xs font-medium hover:bg-[#10b981]/20 transition">
                  Permitir
                </button>
                <button onClick={() => responderReingreso(r.id, false)}
                  className="px-3 py-1.5 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-lg text-xs font-medium hover:bg-[#ef4444]/20 transition">
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* header */}
      <div className="flex items-center justify-between">
        <span className="text-[#94a3b8] text-xs">{usuarios.length} usuarios</span>
        <div className="flex gap-2">
          <button onClick={cargar} disabled={cargando}
            className="flex items-center gap-1.5 text-[#94a3b8] hover:text-white border border-white/10 rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setModalCrear(true)}
            className="flex items-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg px-3 py-1.5 text-xs font-bold transition">
            <Plus className="w-3.5 h-3.5" />Nuevo usuario
          </button>
        </div>
      </div>

      {error && <p className="text-[#ef4444] text-xs">{error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#10b981] animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[#475569] uppercase tracking-wider">
                {['Usuario','Rol','Bodega','Estado','Último login','Acciones'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition">
                  <td className="px-3 py-3">
                    <p className="text-white font-medium">{u.nombre_usuario}</p>
                    {u.totp_habilitado && (
                      <span className="text-[#10b981] text-[10px] flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" />2FA
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {u.rol === 'computadora_madre' ? (
                      <span className="text-[#f59e0b] font-bold">{u.rol}</span>
                    ) : (
                      <select
                        value={u.rol}
                        onChange={(e) => cambiarRol(u.id, e.target.value)}
                        className="bg-[#0f172a] text-white border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#10b981]"
                      >
                        {ROLES_ASIGNABLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[#94a3b8]">{u.bodega?.nombre ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                      u.bloqueado
                        ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                        : 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30'
                    }`}>
                      {u.bloqueado ? 'Bloqueado' : 'Activo'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#94a3b8]">{fmtDt(u.ultimo_login)}</td>
                  <td className="px-3 py-3">
                    {u.rol !== 'computadora_madre' && (
                      <div className="flex gap-1.5">
                        <button onClick={() => toggleBloqueo(u)} title={u.bloqueado ? 'Desbloquear' : 'Bloquear'}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-white transition">
                          {u.bloqueado ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => eliminar(u.id)} title="Eliminar"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-[#ef4444] transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalCrear && <ModalCrearUsuario onCerrar={() => { setModalCrear(false); cargar(); }} />}
    </div>
  );
}