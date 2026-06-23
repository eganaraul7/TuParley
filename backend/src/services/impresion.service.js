'use strict';

// ESC/POS formatting helpers
const ESC  = '\x1B';
const GS   = '\x1D';
const INIT         = `${ESC}@`;
const ALIGN_CENTER = `${ESC}a\x01`;
const ALIGN_LEFT   = `${ESC}a\x00`;
const BOLD_ON      = `${ESC}E\x01`;
const BOLD_OFF     = `${ESC}E\x00`;
const FONT_LARGE   = `${GS}!\x11`;
const FONT_NORMAL  = `${GS}!\x00`;
const CUT          = `${GS}V\x41\x00`;
const LINE         = '-'.repeat(32) + '\n';

function _pad(left, right, width = 32) {
  const espacios = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, espacios)) + right + '\n';
}

function generarComandosEscPos(ticket) {
  const { numero_serie, bodega_nombre, fecha_creacion, selecciones,
          cuota_combinada, monto_apostado_usd, monto_apostado_bs,
          ganancia_potencial_usd, ganancia_potencial_bs,
          tasa_bcv_dia, moneda_pago } = ticket;

  const fecha = new Date(fecha_creacion).toLocaleString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  let cmds = '';
  cmds += INIT;
  cmds += ALIGN_CENTER;
  cmds += FONT_LARGE + BOLD_ON + 'TuParley\n' + BOLD_OFF + FONT_NORMAL;
  cmds += `${bodega_nombre ?? 'Bodega'}\n`;
  cmds += LINE;
  cmds += ALIGN_LEFT;
  cmds += `Fecha : ${fecha}\n`;
  cmds += `Serie : ${numero_serie}\n`;
  cmds += LINE;

  // Selecciones
  for (const sel of (selecciones ?? [])) {
    cmds += BOLD_ON + `${sel.equipo_local ?? ''} vs ${sel.equipo_visitante ?? ''}\n` + BOLD_OFF;
    cmds += `  ${sel.modalidad_nombre ?? ''}: ${sel.seleccion}\n`;
    cmds += _pad('  Cuota:', `x${sel.cuota_aplicada}`);
  }

  cmds += LINE;
  cmds += _pad('Cuota combinada:', `x${parseFloat(cuota_combinada).toFixed(2)}`);
  cmds += LINE;
  cmds += _pad('Apostado USD:', `$${parseFloat(monto_apostado_usd).toFixed(2)}`);
  cmds += _pad('Apostado Bs:', `Bs ${parseFloat(monto_apostado_bs).toFixed(2)}`);
  cmds += _pad('Tasa BCV:', `${parseFloat(tasa_bcv_dia).toFixed(2)} Bs/$`);
  cmds += _pad('Moneda pago:', moneda_pago);
  cmds += LINE;
  cmds += ALIGN_CENTER + BOLD_ON + FONT_LARGE;
  cmds += `GANA: $${parseFloat(ganancia_potencial_usd).toFixed(2)}\n`;
  cmds += `      Bs ${parseFloat(ganancia_potencial_bs).toFixed(2)}\n`;
  cmds += FONT_NORMAL + BOLD_OFF + ALIGN_LEFT;
  cmds += LINE;
  cmds += 'Estado: PENDIENTE\n';
  cmds += '\n';
  cmds += 'Firma/Sello del bodeguero:\n';
  cmds += '\n\n';
  cmds += '_______________________________\n';
  cmds += '\n';
  cmds += ALIGN_CENTER;
  cmds += 'Premio válido 48h desde el\n';
  cmds += 'resultado del último evento.\n';
  cmds += LINE;
  cmds += CUT;

  return cmds;
}

function generarBufferEscPos(ticket) {
  return Buffer.from(generarComandosEscPos(ticket), 'binary');
}

module.exports = { generarComandosEscPos, generarBufferEscPos };