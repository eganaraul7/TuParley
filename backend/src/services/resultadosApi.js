'use strict';

/**
 * resultadosApi.js — interpreta un partido de API-Sports y devuelve el
 * resultado normalizado que usa liquidacion.service:
 *   null                 → el partido no terminó
 *   { suspendido: true } → cancelado / pospuesto / abandonado
 *   { gl, gv, ganador, detalle }
 * Módulo puro (sin BD ni red) para poder probarlo aislado.
 */

const ESTADOS_FINAL = {
  futbol:     ['FT', 'AET', 'PEN'],
  baloncesto: ['FT', 'AOT'],
  beisbol:    ['FT', 'AOT'],
  mma:        ['FT', 'FIN', 'END'],
};
const ESTADOS_SUSPENDIDO = ['CANC', 'PST', 'SUSP', 'ABD', 'AWD', 'WO'];

function resultadoApi(deporte, f) {
  const status = String(f.fixture?.status?.short ?? f.status?.short ?? f.status ?? '').toUpperCase();
  if (ESTADOS_SUSPENDIDO.includes(status)) return { suspendido: true };
  if (!(ESTADOS_FINAL[deporte] ?? []).includes(status)) return null;

  if (deporte === 'futbol') {
    // score.fulltime = marcador al final del tiempo reglamentario (90')
    const gl = f.score?.fulltime?.home ?? f.goals?.home ?? null;
    const gv = f.score?.fulltime?.away ?? f.goals?.away ?? null;
    const detalle = status === 'AET' ? 'tiempo_extra' : status === 'PEN' ? 'penales' : 'ninguno';
    return { gl, gv, ganador: null, detalle };
  }
  if (deporte === 'mma') {
    const p1 = f.fighters?.first ?? f.fighters?.home;
    const p2 = f.fighters?.second ?? f.fighters?.away;
    const ganador = p1?.winner === true ? 'local' : p2?.winner === true ? 'visitante' : null;
    return { gl: null, gv: null, ganador, detalle: null };
  }
  const total = (lado) => {
    const v = f.scores?.[lado]?.total ?? f.scores?.[lado];
    return v === null || v === undefined || typeof v === 'object' ? null : Number(v);
  };
  return { gl: total('home'), gv: total('away'), ganador: null, detalle: null };
}

module.exports = { resultadoApi, ESTADOS_FINAL, ESTADOS_SUSPENDIDO };
