// Archivo: TabBcv.jsx
// Ruta: frontend/src/components/admin/TabBcv.jsx
// Función: tab del panel admin — tasa BCV vigente, estado de la consulta
//          automática, botón para consultar la API al momento y carga manual
//          cuando la API falla (rango validado por el backend).

import { useState, useEffect, useCallback } from 'react';
import { Loader2, DollarSign, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useBcvStore } from '../../store/bcvStore';
import { bcvService } from '../../services/bcvService';
import { mensajeError } from '../../utils/errores';
import { fmtDt } from '../../utils/formatters';

export default function TabBcv() {
  const setTasaBcv = useBcvStore((s) => s.setTasaBcv);
  const [info, setInfo]           = useState(null);   // { tasa, rango, estado_api }
  const [valor, setValor]         = useState('');
  const [guardando, setGuardando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [ok, setOk]               = useState('');
  const [error, setError]         = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await bcvService.actual();
      setInfo(res);
      if (res?.tasa) setTasaBcv(res.tasa.valor, res.tasa.fuente, res.tasa.fecha);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo consultar la tasa vigente.'));
    }
  }, [setTasaBcv]);

  useEffect(() => { cargar(); }, [cargar]);

  const rango = info?.rango ?? { minimo: 0, maximo: Infinity };
  const tasa  = info?.tasa ?? null;
  const estado = info?.estado_api ?? null;

  async function handleConsultarApi() {
    setConsultando(true); setError(''); setOk('');
    try {
      const res = await bcvService.actualizarDesdeApi();
      setOk(`Tasa obtenida de la API: Bs ${Number(res.valor).toFixed(2)}`);
      await cargar();
    } catch (err) {
      setError(mensajeError(err, 'La API no respondió. Carga la tasa manualmente.'));
      await cargar();
    } finally {
      setConsultando(false);
    }
  }

  async function handleGuardar() {
    const num = Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(num) || num < rango.minimo || num > rango.maximo) {
      setError(`El valor debe estar entre ${rango.minimo} y ${rango.maximo} Bs/$.`);
      return;
    }
    setGuardando(true); setError(''); setOk('');
    try {
      await bcvService.setManual(num);
      setOk('Tasa manual aplicada y enviada a todas las tablets.');
      setValor('');
      await cargar();
    } catch (err) {
      setError(mensajeError(err, 'Error al guardar.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-sm space-y-4">
      {/* tasa vigente */}
      <div className="bg-[#0f172a] rounded-xl p-5 border border-white/5 text-center">
        <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium mb-1">Tasa BCV vigente</p>
        <p className="text-[#10b981] text-4xl font-bold">
          {tasa ? `Bs ${Number(tasa.valor).toFixed(2)}` : '—'}
        </p>
        <p className="text-[#475569] text-xs mt-1">por $1 USD</p>
        {tasa && (
          <p className="text-[#94a3b8] text-[11px] mt-2">
            {tasa.fuente === 'manual' ? 'Cargada manualmente' : 'Obtenida de la API'} · {tasa.fecha}
          </p>
        )}
        {tasa && !tasa.es_de_hoy && (
          <p className="text-[#f59e0b] text-[11px] mt-1 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> No es la tasa de hoy: consulta la API o cárgala a mano
          </p>
        )}
      </div>

      {/* consulta automática */}
      <div className="bg-[#0f172a] rounded-xl p-4 border border-white/5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white text-xs font-bold">Consulta automática</p>
          <button
            onClick={handleConsultarApi}
            disabled={consultando}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981]/10 rounded-lg px-3 py-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${consultando ? 'animate-spin' : ''}`} />
            Consultar API ahora
          </button>
        </div>
        <p className="text-[#475569] text-[11px]">
          Se consulta todos los días a las 9:00 AM y cada hora mientras no haya tasa del día.
          Una tasa manual del día no se reemplaza automáticamente.
        </p>
        {estado && (
          <p className={`text-[11px] ${estado.exito ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            Último intento {fmtDt(estado.fecha)}: {estado.exito ? `OK (Bs ${Number(estado.valor).toFixed(2)})` : `falló — ${estado.error}`}
          </p>
        )}
      </div>

      {/* carga manual */}
      <div>
        <label className="text-[#94a3b8] text-xs uppercase tracking-wider font-medium block mb-1.5">
          Tasa manual (si la API falla)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-xs font-bold">Bs</span>
          <input type="number" min={rango.minimo} max={Number.isFinite(rango.maximo) ? rango.maximo : undefined} step="0.01"
            value={valor} onChange={(e) => { setValor(e.target.value); setOk(''); setError(''); }}
            placeholder={tasa ? Number(tasa.valor).toFixed(2) : '0.00'}
            className="w-full bg-[#0f172a] text-white border border-white/10 rounded-xl pl-9 pr-4 py-3 text-right font-bold focus:outline-none focus:border-[#10b981]" />
        </div>
        {info?.rango && (
          <p className="text-[#475569] text-[11px] mt-1">Rango permitido: {rango.minimo} – {rango.maximo} Bs/$</p>
        )}
      </div>

      {error && <p className="text-[#ef4444] text-xs">{error}</p>}
      {ok    && <p className="text-[#10b981] text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{ok}</p>}

      <button onClick={handleGuardar} disabled={guardando || !valor}
        className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
        Aplicar tasa manual
      </button>
    </div>
  );
}
