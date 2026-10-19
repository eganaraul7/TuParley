'use strict';

// Extrae la tasa de la respuesta de la API BCV (módulo puro, sin BD ni red).
// Acepta el objeto de DolarAPI { promedio, venta, compra }, la lista de
// cotizaciones (toma la 'oficial') o el formato { price }.
function extraerValor(data) {
  let d = data;
  if (Array.isArray(d)) d = d.find((x) => String(x?.fuente ?? x?.casa ?? '').toLowerCase() === 'oficial') ?? d[0];
  const crudo = d?.promedio ?? d?.price ?? d?.venta ?? d?.compra;
  const valor = typeof crudo === 'string' ? parseFloat(crudo.replace(',', '.')) : Number(crudo);
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 10000) / 10000 : null;
}

module.exports = { extraerValor };
