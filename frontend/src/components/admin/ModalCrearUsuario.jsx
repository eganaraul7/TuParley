// Archivo: ModalCrearUsuario.jsx
// Ruta: frontend/src/components/admin/ModalCrearUsuario.jsx
// Función: modal para que el admin cree un nuevo usuario (bodeguero/admin/
//          desconocido). Usado dentro de TabUsuarios. Extraído de
//          AdminPage.jsx (Paso 4 de reorganización components/).

import { useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { usuariosService } from '../../services/usuariosService';

const ROLES_ASIGNABLES = ['administrador', 'bodeguero', 'desconocido'];

export default function ModalCrearUsuario({ onCerrar }) {
  const [form, setForm]         = useState({ nombre_usuario: '', contrasena: '', rol: 'bodeguero', bodega_id: '' });
  const [bodegas, setBodegas]   = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    // GET /api/usuarios retorna bodega anidada en cada usuario;
    // para el select usar las bodegas únicas extraídas del listado de usuarios
    usuariosService.listar()
      .then((r) => {
        const vistas = new Map();
        (r?.usuarios ?? []).forEach((u) => {
          if (u.bodega_id && u.bodega) vistas.set(u.bodega_id, u.bodega);
        });
        setBodegas([...vistas.values()]);
      })
      .catch(() => {});
  }, []);

  async function handleGuardar() {
    if (!form.nombre_usuario.trim() || !form.contrasena.trim()) { setError('Completa todos los campos.'); return; }
    setCargando(true); setError('');
    try {
      await usuariosService.crear(form);
      onCerrar();
    } catch (err) { setError(err.response?.data?.mensaje ?? 'Error al crear usuario.'); }
    finally { setCargando(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-2xl border border-white/10 w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">Nuevo usuario</h3>
          <button onClick={onCerrar} className="text-[#94a3b8] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        {[
          { key: 'nombre_usuario', label: 'Usuario', type: 'text', placeholder: 'nombre_usuario' },
          { key: 'contrasena',     label: 'Contraseña', type: 'password', placeholder: '••••••••' },
        ].map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1">{label}</label>
            <input type={type} value={form[key]} placeholder={placeholder}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full bg-[#0f172a] text-white border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#10b981]" />
          </div>
        ))}
        <div>
          <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1">Rol</label>
          <select value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
            className="w-full bg-[#0f172a] text-white border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#10b981]">
            {ROLES_ASIGNABLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {error && <p className="text-[#ef4444] text-xs">{error}</p>}
        <button onClick={handleGuardar} disabled={cargando}
          className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear usuario
        </button>
      </div>
    </div>
  );
}