// Archivo: AdminPage.jsx
// Ruta: frontend/src/pages/AdminPage.jsx
// Función: panel de administración — shell con sidebar de 7 tabs. Refactorizado
//          en el Paso 8 (último paso de extracción): los 8 componentes inline
//          (TabUsuarios, ModalCrearUsuario, TabAnulaciones, TabEventos, TabBcv,
//          TabReportes, TabNotificaciones, TabConfiguracion) se movieron a
//          components/admin/. Fix: se eliminaron 5 imports de íconos muertos
//          (Edit2, Eye, EyeOff, ChevronDown, ChevronUp) que nunca se usaban.

import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import {
  Users, Ticket, Activity, DollarSign,
  Bell, Settings, FileText, LogOut, Store,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSocket }    from '../hooks/useSocket';
import {
  TabUsuarios, TabAnulaciones, TabEventos, TabBcv,
  TabReportes, TabNotificaciones, TabConfiguracion, TabBodegas,
} from '../components/admin';

const TABS = [
  { key: 'usuarios',       label: 'Usuarios',       Icon: Users      },
  { key: 'anulaciones',    label: 'Anulaciones',     Icon: Ticket     },
  { key: 'eventos',        label: 'Eventos',         Icon: Activity   },
  { key: 'bcv',            label: 'BCV',             Icon: DollarSign },
  { key: 'bodegas',        label: 'Bodegas',         Icon: Store      },
  { key: 'reportes',       label: 'Reportes',        Icon: FileText   },
  { key: 'notificaciones', label: 'Notificaciones',  Icon: Bell       },
  { key: 'configuracion',  label: 'Configuración',   Icon: Settings   },
];

export default function AdminPage() {
  const navigate               = useNavigate();
  const { usuario, clearAuth } = useAuthStore((s) => s);
  const [tabActiva,    setTabActiva]    = useState('usuarios');
  const [notifsCount,  setNotifsCount]  = useState(0);

  useSocket();

  useEffect(() => {
    if (!usuario || !['computadora_madre', 'administrador'].includes(usuario.rol)) {
      navigate('/login', { replace: true });
    }
  }, [usuario]);

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-[#0f172a] text-white overflow-hidden">

      {/* Sidebar */}
      <aside className="w-52 bg-[#1e293b] border-r border-white/5 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/5">
          <span className="w-7 h-7 rounded-lg bg-[#10b981] flex items-center justify-center text-white text-xs font-black">TP</span>
          <div>
            <p className="text-white text-sm font-bold leading-none">TuParley</p>
            <p className="text-[#334155] text-[10px] mt-0.5">Panel Admin</p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-white text-xs font-semibold truncate">{usuario?.nombre_usuario}</p>
          <p className="text-[#334155] text-[10px] capitalize">{usuario?.rol?.replace('_', ' ')}</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {TABS.map(({ key, label, Icon }) => {
            const activo = tabActiva === key;
            return (
              <button key={key} onClick={() => setTabActiva(key)}
                className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-all
                  ${activo ? 'bg-[#10b981]/10 text-[#10b981]' : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'}`}
              >
                {activo && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#10b981] rounded-r-full" />}
                <Icon className="w-4 h-4 shrink-0" />
                <span className="font-medium">{label}</span>
                {key === 'notificaciones' && notifsCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-[#ef4444] text-white rounded-full w-5 h-5 flex items-center justify-center">
                    {notifsCount > 9 ? '9+' : notifsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[#475569] hover:text-[#ef4444] hover:bg-[#ef4444]/5 text-sm transition">
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 shrink-0">
          <h1 className="text-white font-bold text-base">
            {TABS.find((t) => t.key === tabActiva)?.label}
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {tabActiva === 'usuarios'       && <TabUsuarios />}
          {tabActiva === 'anulaciones'    && <TabAnulaciones />}
          {tabActiva === 'eventos'        && <TabEventos />}
          {tabActiva === 'bcv'            && <TabBcv />}
          {tabActiva === 'bodegas'        && <TabBodegas />}
          {tabActiva === 'reportes'       && <TabReportes />}
          {tabActiva === 'notificaciones' && <TabNotificaciones onContadorChange={setNotifsCount} />}
          {tabActiva === 'configuracion'  && <TabConfiguracion />}
        </div>
      </main>
    </div>
  );
}