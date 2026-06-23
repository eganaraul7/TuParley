// Archivo: AdminPage.jsx
// Ruta: frontend/src/pages/AdminPage.jsx
// Función: panel de administración — shell con sidebar de 7 tabs. Refactorizado
//          en el Paso 8 (último paso de extracción): los 8 componentes inline
//          (TabUsuarios, ModalCrearUsuario, TabAnulaciones, TabEventos, TabBcv,
//          TabReportes, TabNotificaciones, TabConfiguracion) se movieron a
//          components/admin/. Fix: se eliminaron 5 imports de íconos muertos
//          (Edit2, Eye, EyeOff, ChevronDown, ChevronUp) que nunca se usaban.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Ticket, Activity, DollarSign, Bell, Settings, FileText, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSocket }    from '../hooks/useSocket';
import {
  TabUsuarios, TabAnulaciones, TabEventos, TabBcv,
  TabReportes, TabNotificaciones, TabConfiguracion,
} from '../components/admin';

const TABS = [
  { key: 'usuarios',       label: 'Usuarios',      icono: Users      },
  { key: 'anulaciones',    label: 'Anulaciones',   icono: Ticket     },
  { key: 'eventos',        label: 'Eventos',       icono: Activity   },
  { key: 'bcv',            label: 'BCV',           icono: DollarSign },
  { key: 'reportes',       label: 'Reportes',      icono: FileText   },
  { key: 'notificaciones', label: 'Notificaciones',icono: Bell       },
  { key: 'configuracion',  label: 'Configuración', icono: Settings  },
];

export default function AdminPage() {
  const navigate                  = useNavigate();
  const { usuario, clearAuth }    = useAuthStore((s) => s);
  const [tabActiva, setTabActiva] = useState('usuarios');
  const [notifsCount, setNotifsCount] = useState(0);

  // redirigir si no es admin
  useEffect(() => {
    const rol = usuario?.rol;
    if (rol && rol !== 'computadora_madre' && rol !== 'administrador') {
      navigate('/dashboard', { replace: true });
    }
  }, [usuario]);

  useSocket('notificacion', () => setNotifsCount((c) => c + 1));
  useSocket('mantenimiento', () => {}); // admins siempre pasan

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f172a] overflow-hidden">

      <header className="h-14 bg-[#1e293b] border-b border-white/5 flex items-center px-4 gap-3 shrink-0">
        <span className="text-[#10b981] font-bold text-lg tracking-tight mr-2">TP</span>
        <span className="text-white font-bold text-sm">Panel de administración</span>
        <div className="flex-1" />
        <span className="text-[#94a3b8] text-xs hidden sm:block">{usuario?.nombre_usuario}</span>
        <span className="text-[#f59e0b] text-[11px] font-bold border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-2 py-0.5 rounded-full capitalize">
          {usuario?.rol}
        </span>
        <button onClick={handleLogout}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f172a] border border-white/10 text-[#94a3b8] hover:text-[#ef4444] hover:border-[#ef4444]/30 transition">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        <nav className="w-44 bg-[#1e293b] border-r border-white/5 flex flex-col py-3 px-2 gap-1 shrink-0">
          {TABS.map(({ key, label, icono: Icono }) => {
            const activo = tabActiva === key;
            return (
              <button key={key} onClick={() => setTabActiva(key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-medium transition relative
                  ${activo
                    ? 'bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981]'
                    : 'text-[#94a3b8] hover:bg-white/5 hover:text-white border border-transparent'}`}>
                <Icono className="w-4 h-4 shrink-0" />
                {label}
                {key === 'notificaciones' && notifsCount > 0 && (
                  <span className="ml-auto bg-[#ef4444] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                    {notifsCount > 9 ? '9+' : notifsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto p-6">
          <h2 className="text-white font-bold text-lg mb-5 capitalize">
            {TABS.find((t) => t.key === tabActiva)?.label}
          </h2>

          {tabActiva === 'usuarios'       && <TabUsuarios />}
          {tabActiva === 'anulaciones'    && <TabAnulaciones />}
          {tabActiva === 'eventos'        && <TabEventos />}
          {tabActiva === 'bcv'            && <TabBcv />}
          {tabActiva === 'reportes'       && <TabReportes />}
          {tabActiva === 'notificaciones' && <TabNotificaciones onContadorChange={setNotifsCount} />}
          {tabActiva === 'configuracion'  && <TabConfiguracion />}
        </main>
      </div>
    </div>
  );
}