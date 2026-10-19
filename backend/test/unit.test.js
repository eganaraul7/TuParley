'use strict';

// Pruebas unitarias sin BD ni red: npm test
const test   = require('node:test');
const assert = require('node:assert/strict');

const { evaluarSeleccion, resultadoDesdeEvento } = require('../src/services/liquidacion.service');
const { resultadoApi }  = require('../src/services/resultadosApi');
const { hoyVET, minutosDelDiaVET, sumarDias, rangoSemanaVET, rangoMes } = require('../src/utils/fecha');
const { paginacion }    = require('../src/utils/paginacion');
const { generarHashTicket, verificarHashTicket } = require('../src/services/hash.service');

const sel = (tipo, extra = {}) => ({ tipo_resultado: tipo, marcador_local: null, marcador_visitante: null, detalle_fin: null, ...extra });

test('liquidación: resultado directo', () => {
  const r = { gl: 2, gv: 1, ganador: null, detalle: 'ninguno' };
  assert.equal(evaluarSeleccion(sel('local'), r, 'futbol'), 'ganado');
  assert.equal(evaluarSeleccion(sel('visitante'), r, 'futbol'), 'perdido');
  assert.equal(evaluarSeleccion(sel('empate'), r, 'futbol'), 'perdido');
  assert.equal(evaluarSeleccion(sel('empate'), { gl: 1, gv: 1, detalle: 'ninguno' }, 'futbol'), 'ganado');
});

test('liquidación: marcador exacto', () => {
  const r = { gl: 2, gv: 1, detalle: 'ninguno' };
  assert.equal(evaluarSeleccion(sel('local', { marcador_local: 2, marcador_visitante: 1 }), r, 'futbol'), 'ganado');
  assert.equal(evaluarSeleccion(sel('local', { marcador_local: 3, marcador_visitante: 1 }), r, 'futbol'), 'perdido');
});

test('liquidación: baloncesto por rango de diferencia', () => {
  const s = sel('visitante', { marcador_local: 6, marcador_visitante: 10 });
  assert.equal(evaluarSeleccion(s, { gl: 90, gv: 98 }, 'baloncesto'), 'ganado');
  assert.equal(evaluarSeleccion(s, { gl: 90, gv: 92 }, 'baloncesto'), 'perdido');
  assert.equal(evaluarSeleccion(s, { gl: 99, gv: 90 }, 'baloncesto'), 'perdido');
});

test('liquidación: tiempo extra / penales en fútbol', () => {
  const pen = sel('empate', { detalle_fin: 'penales' });
  assert.equal(evaluarSeleccion(pen, { gl: 1, gv: 1, detalle: 'penales' }, 'futbol'), 'ganado');
  assert.equal(evaluarSeleccion(pen, { gl: 1, gv: 1, detalle: 'tiempo_extra' }, 'futbol'), 'perdido');
  assert.equal(evaluarSeleccion(pen, { gl: 1, gv: 1, detalle: 'ninguno' }, 'futbol'), 'perdido');
});

test('liquidación: sin datos suficientes queda pendiente (null), nunca perdida', () => {
  assert.equal(evaluarSeleccion(sel('local'), { gl: null, gv: null, ganador: null }, 'tenis'), null);
  assert.equal(evaluarSeleccion(sel('local', { detalle_fin: 'ko' }), { ganador: 'local', detalle: null }, 'mma'), null);
  assert.equal(evaluarSeleccion(sel('local', { detalle_fin: 'ko' }), { ganador: 'visitante', detalle: null }, 'mma'), 'perdido');
  assert.equal(evaluarSeleccion(sel('local', { detalle_fin: 'ko' }), { ganador: 'local', detalle: 'ko' }, 'mma'), 'ganado');
});

test('liquidación: modalidades antiguas solo con valores inequívocos', () => {
  const legacy = (s) => ({ tipo_resultado: 'no_aplica', seleccion: s });
  assert.equal(evaluarSeleccion(legacy('1'), { gl: 2, gv: 0 }, 'futbol'), 'ganado');
  assert.equal(evaluarSeleccion(legacy('over_2.5'), { gl: 2, gv: 0 }, 'futbol'), 'perdido');
  assert.equal(evaluarSeleccion(legacy('Doble Oportunidad'), { gl: 2, gv: 0 }, 'futbol'), null);
});

test('resultadoDesdeEvento: fútbol finalizado sin detalle = tiempo reglamentario', () => {
  const r = resultadoDesdeEvento({ deporte: 'futbol', estado: 'finalizado', resultado_final: '2-2' });
  assert.deepEqual(r, { gl: 2, gv: 2, ganador: 'empate', detalle: 'ninguno' });
  const mma = resultadoDesdeEvento({ deporte: 'mma', estado: 'finalizado', resultado_final: null, ganador_final: 'local' });
  assert.equal(mma.ganador, 'local');
  assert.equal(mma.detalle, null);
});

test('resultadoApi: estados de API-Sports', () => {
  assert.equal(resultadoApi('futbol', { fixture: { status: { short: '2H' } } }), null);
  assert.deepEqual(resultadoApi('futbol', { fixture: { status: { short: 'PST' } } }), { suspendido: true });
  const pen = resultadoApi('futbol', { fixture: { status: { short: 'PEN' } }, score: { fulltime: { home: 1, away: 1 } }, goals: { home: 2, away: 2 } });
  assert.deepEqual(pen, { gl: 1, gv: 1, ganador: null, detalle: 'penales' });
  const bal = resultadoApi('baloncesto', { status: { short: 'AOT' }, scores: { home: { total: 101 }, away: { total: 99 } } });
  assert.equal(bal.gl, 101);
  const mma = resultadoApi('mma', { status: { short: 'FT' }, fighters: { first: { winner: false }, second: { winner: true } } });
  assert.equal(mma.ganador, 'visitante');
});

test('fecha: hora de Venezuela', () => {
  // 02:00 UTC del 19 = 22:00 VET del 18
  assert.equal(hoyVET(new Date('2026-10-19T02:00:00Z')), '2026-10-18');
  assert.equal(minutosDelDiaVET(new Date('2026-10-19T02:00:00Z')), 22 * 60);
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.deepEqual(rangoSemanaVET(new Date('2026-10-25T15:00:00Z')), { desde: '2026-10-19', hasta: '2026-10-25' });
  assert.deepEqual(rangoMes(2, 2028), { desde: '2028-02-01', hasta: '2028-02-29' });
});

test('paginacion: enteros acotados y alias en español', () => {
  assert.deepEqual(paginacion({ page: '2', limit: '10' }).sql, ' LIMIT 10 OFFSET 10');
  assert.equal(paginacion({ pagina: '3', limite: '20' }).offset, 40);
  assert.equal(paginacion({ limit: '99999' }).limit, 200);
  assert.equal(paginacion({ page: '1; DROP TABLE x' }).page, 1);
});

test('hash de ticket: estable y sensible a cambios', () => {
  const t = { numero_serie: 'B1-1234-5678', bodega_id: 1, usuario_id: 2, monto_apostado_usd: 5,
    cuota_combinada: 1.4, selecciones: [{ evento_id: 3, modalidad_id: 26, cuota_aplicada: 1.4 }], ts: 1700000000000 };
  const h = generarHashTicket(t);
  assert.ok(verificarHashTicket(t, h));
  assert.ok(!verificarHashTicket({ ...t, cuota_combinada: 50 }, h));
});

test('BCV: lectura de la respuesta de la API', () => {
  const { extraerValor } = require('../src/services/bcvRespuesta');
  assert.equal(extraerValor({ fuente: 'oficial', promedio: 200.75 }), 200.75);
  assert.equal(extraerValor([{ fuente: 'paralelo', promedio: 999 }, { fuente: 'oficial', promedio: 201.5 }]), 201.5);
  assert.equal(extraerValor({ price: '202,25' }), 202.25);
  assert.equal(extraerValor({ promedio: null, venta: 203 }), 203);
  assert.equal(extraerValor({}), null);
  assert.equal(extraerValor({ promedio: -1 }), null);
});
