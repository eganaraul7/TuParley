'use strict';

/**
 * fecha.js — utilidades de fecha en hora de Venezuela (America/Caracas, UTC-4).
 * toISOString() devuelve UTC: entre las 20:00 y las 23:59 VET ya marca el día
 * siguiente. Todo cálculo de "hoy" / rangos de reporte debe pasar por aquí.
 */

const TZ = 'America/Caracas';

const fmtFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const fmtHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// 'YYYY-MM-DD' del día actual (o de `d`) en Venezuela
function hoyVET(d = new Date()) {
  return fmtFecha.format(d);
}

// Minutos transcurridos desde la medianoche en Venezuela
function minutosDelDiaVET(d = new Date()) {
  const partes = Object.fromEntries(fmtHora.formatToParts(d).map((p) => [p.type, p.value]));
  return Number(partes.hour) * 60 + Number(partes.minute);
}

// Suma n días a una fecha 'YYYY-MM-DD'
function sumarDias(fecha, n) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Lunes y domingo de la semana actual (VET)
function rangoSemanaVET(d = new Date()) {
  const hoy = hoyVET(d);
  const [y, m, dd] = hoy.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); // 0 = domingo
  const lunes = sumarDias(hoy, diaSemana === 0 ? -6 : 1 - diaSemana);
  return { desde: lunes, hasta: sumarDias(lunes, 6) };
}

// Primer y último día de un mes
function rangoMes(mes, anio) {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}` };
}

// { mes, anio } actuales en VET
function mesActualVET(d = new Date()) {
  const [anio, mes] = hoyVET(d).split('-').map(Number);
  return { mes, anio };
}

module.exports = { TZ, hoyVET, minutosDelDiaVET, sumarDias, rangoSemanaVET, rangoMes, mesActualVET };
