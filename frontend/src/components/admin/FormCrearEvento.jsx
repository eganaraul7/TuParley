// Nombre de archivo: FormCrearEvento.jsx
// Ruta: frontend/src/components/admin/FormCrearEvento.jsx
// Función: Admin — alta manual de un evento (cuando la API de deportes no lo trae).
//          La fecha se interpreta en hora de Venezuela.

import { useState } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { eventosService } from '../../services/eventosService';
import { DEPORTES } from '../../utils/constants';
import { mensajeError } from '../../utils/errores';

const VACIO = { deporte: 'futbol', liga: '', equipo_local: '', equipo_visitante: '', fecha_inicio: '', tipo_fase: 'amistoso' };

export default function FormCrearEvento() {
  const [form, setForm]         = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk]             = useState(false);
  const [error, setError]       = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const completo = form.liga.trim() && form.equipo_local.trim() && form.equipo_visitante.trim() && form.fecha_inicio;

  async function crear(e) {
    e.preventDefault();
    setEnviando(true); setError(''); setOk(false);
    try {
      await eventosService.crear({
        ...form,
        liga:             form.liga.trim(),
        equipo_local:     form.equipo_local.trim(),
        equipo_visitante: form.equipo_visitante.trim(),
        // datetime-local → 'YYYY-MM-DD HH:mm:00' (hora de Venezuela)
        fecha_inicio:     `${form.fecha_inicio.replace('T', ' ')}:00`,
      });
      setOk(true);
      setForm((f) => ({ ...VACIO, deporte: f.deporte, liga: f.liga }));
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear el evento.'));
    } finally {
      setEnviando(false);
    }
  }

  const campo = 'w-full bg-[#0f172a] text-white text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#10b981]';

  return (
    <form onSubmit={crear} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <select value={form.deporte} onChange={set('deporte')} className={campo}>
        {DEPORTES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
      </select>
      <input value={form.liga} onChange={set('liga')} placeholder="Liga / torneo" className={campo} maxLength={150} />
      <input value={form.equipo_local} onChange={set('equipo_local')} placeholder="Local / jugador 1" className={campo} maxLength={150} />
      <input value={form.equipo_visitante} onChange={set('equipo_visitante')} placeholder="Visitante / jugador 2" className={campo} maxLength={150} />
      <input type="datetime-local" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={campo} />
      <select value={form.tipo_fase} onChange={set('tipo_fase')} className={campo}>
        <option value="amistoso">Amistoso</option>
        <option value="fase_grupos">Fase de grupos</option>
        <option value="eliminatoria">Eliminatoria (permite tiempo extra / penales)</option>
      </select>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={!completo || enviando}
          className="bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-40 flex items-center gap-1.5"
        >
          {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Crear evento
        </button>
        {ok && <span className="text-[#10b981] text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Evento creado</span>}
        {error && <span className="text-[#ef4444] text-xs">{error}</span>}
      </div>
    </form>
  );
}
