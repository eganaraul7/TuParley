import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import LoginPage           from './pages/LoginPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import DashboardPage       from './pages/DashboardPage';
import AdminPage           from './pages/AdminPage';
import HistorialPage       from './pages/HistorialPage';
import CierreCajaPage      from './pages/CierreCajaPage';

import { useAuthStore } from './store/authStore';
import { useBcvStore }  from './store/bcvStore';
import { useSocket }    from './hooks/useSocket';
import { connectSocket, disconnectSocket } from './services/socket';
import { bcvService }   from './services/bcvService';
import { iniciarAutoSync } from './services/offlineQueue';
import { rutaPorRol } from './utils/roles';

// ─── ProtectedRoute ────────────────────────────────────────────────────────────
/**
 * Envuelve páginas que requieren sesión activa.
 * @param {string[]} roles  Roles permitidos. Si se omite, cualquier rol logueado pasa.
 */
function ProtectedRoute({ children, roles }) {
  const { isLoggedIn, usuario } = useAuthStore((s) => s);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // desconocido solo puede estar en /pending-approval
  if (usuario?.rol === 'desconocido' && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  // si la ruta exige roles específicos y el usuario no califica → redirigir a su home
  if (roles && !roles.includes(usuario?.rol)) {
    return <Navigate to={rutaPorRol(usuario?.rol)} replace />;
  }

  return children;
}

// ─── AppShell: lógica global (socket + tasa BCV inicial) ──────────────────────
function AppShell() {
  const token       = useAuthStore((s) => s.token);
  const isLoggedIn  = useAuthStore((s) => s.isLoggedIn);
  const usuario     = useAuthStore((s) => s.usuario);
  const setTasaBcv  = useBcvStore((s) => s.setTasaBcv);
  const setErrorBcv = useBcvStore((s) => s.setError);

  // conectar/desconectar socket según sesión
  useEffect(() => {
    if (token) {
      connectSocket(token);
    } else {
      disconnectSocket();
    }
    return () => disconnectSocket();
  }, [token]);

  // tasa BCV inicial al loguear (el socket mantiene actualizaciones después)
  useEffect(() => {
    if (!isLoggedIn) return;

    let activo = true;
    bcvService
      .actual()
      .then((res) => {
        if (activo && res?.tasa) {
          setTasaBcv(res.tasa.valor, res.tasa.fuente, res.tasa.fecha);
        }
      })
      .catch(() => activo && setErrorBcv());

    return () => { activo = false; };
  }, [isLoggedIn]);

  // intentar sincronizar tickets offline al loguear y cada vez que vuelva la conexión
  useEffect(() => {
    if (!isLoggedIn) return;
    const limpiar = iniciarAutoSync();
    return limpiar;
  }, [isLoggedIn]);

  // mantener tasa BCV sincronizada en tiempo real para toda la app
  useSocket('bcv_actualizada', (payload) => {
    if (payload?.valor) setTasaBcv(payload.valor, 'api');
  });

  return (
    <Routes>
      {/* públicas */}
      <Route path="/login" element={<LoginPage />} />

      {/* pendiente de aprobación */}
      <Route
        path="/pending-approval"
        element={
          <ProtectedRoute roles={['desconocido']}>
            <PendingApprovalPage />
          </ProtectedRoute>
        }
      />

      {/* bodeguero (+ admins, por si operan tablet) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['bodeguero', 'administrador', 'computadora_madre']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/historial"
        element={
          <ProtectedRoute roles={['bodeguero', 'administrador', 'computadora_madre']}>
            <HistorialPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cierre-caja"
        element={
          <ProtectedRoute roles={['bodeguero']}>
            <CierreCajaPage />
          </ProtectedRoute>
        }
      />

      {/* solo administración */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['administrador', 'computadora_madre']}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      {/* raíz: redirigir según estado de sesión */}
      <Route
        path="/"
        element={
          isLoggedIn
            ? <Navigate to={rutaPorRol(usuario?.rol)} replace />
            : <Navigate to="/login" replace />
        }
      />

      {/* catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}