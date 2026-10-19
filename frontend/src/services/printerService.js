// Archivo: printerService.js
// Ruta: frontend/src/services/printerService.js
// Función: impresión térmica ESC/POS directo desde el navegador (sin backend),
//          vía WebUSB o Web Bluetooth — la impresora está conectada a la
//          TABLET, no al servidor, así que el ticket se imprime también
//          cuando no hay internet (cola offline).
//
// ⚠️ LIMITACIÓN REAL DE WEB BLUETOOTH:
//    La mayoría de impresoras térmicas baratas (58mm) usan Bluetooth Classic
//    SPP, que Web Bluetooth NO puede acceder (solo soporta BLE/GATT). Si la
//    impresora de la bodega es SPP-only, USA LA CONEXIÓN USB.

// Servicios BLE usados por impresoras térmicas comunes (Microchip/ISSC, genéricas
// chinas 18F0/FF00/FFE0, etc.). La característica de escritura se busca sola.
const BLE_SERVICIOS = [
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

const ESC = '\x1B';
const GS  = '\x1D';
const INIT         = `${ESC}@`;
const ALIGN_CENTER = `${ESC}a\x01`;
const ALIGN_LEFT   = `${ESC}a\x00`;
const BOLD_ON      = `${ESC}E\x01`;
const BOLD_OFF     = `${ESC}E\x00`;
const FONT_LARGE   = `${GS}!\x11`;
const FONT_NORMAL  = `${GS}!\x00`;
const CUT          = `${GS}V\x41\x00`;
const LINE         = '-'.repeat(32) + '\n';


const DETALLE_IMPRESION = {
  tiempo_extra: 'Tiempo extra', penales: 'Penales',
  ko: 'KO', tko: 'TKO', sumision: 'Sumision', decision: 'Decision',
};

// Las impresoras térmicas no traen UTF-8 y la página de códigos por defecto
// (CP437) imprime basura con tildes/ñ: se convierte el texto a ASCII.
function _ascii(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/[¿¡]/g, '')
    .replace(/[\u00a0\u2000-\u200b\u202f]/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, '?');
}

function _pad(left, right, width = 32) {
  const espacios = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, espacios)) + right + '\n';
}

function generarComandosEscPos(ticket) {
  const {
    numero_serie, bodega_nombre, fecha_creacion, selecciones,
    cuota_combinada, monto_apostado_usd, monto_apostado_bs,
    ganancia_potencial_usd, ganancia_potencial_bs,
    tasa_bcv_dia, moneda_pago, estado,
  } = ticket;

  const fecha = new Date(fecha_creacion).toLocaleString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  let cmds = '';
  cmds += INIT;
  cmds += ALIGN_CENTER;
  cmds += FONT_LARGE + BOLD_ON + 'TuParley\n' + BOLD_OFF + FONT_NORMAL;
  cmds += `${_ascii(bodega_nombre ?? 'Bodega')}\n`;
  cmds += LINE;
  cmds += ALIGN_LEFT;
  cmds += `Fecha : ${_ascii(fecha)}\n`;
  cmds += `Serie : ${numero_serie}\n`;
  cmds += LINE;

  for (const sel of (selecciones ?? [])) {
    cmds += BOLD_ON + `${_ascii(sel.equipos ?? `${sel.equipo_local ?? ''} vs ${sel.equipo_visitante ?? ''}`)}\n` + BOLD_OFF;
    cmds += `  ${sel.seleccion === 'Empate' ? 'Resultado' : 'Gana'}: ${_ascii(sel.seleccion)}\n`;
    // Opcionales elegidos: marcador exacto / rango y detalle de fin
    const extras = [];
    if (sel.marcador_local !== null && sel.marcador_local !== undefined) {
      extras.push(sel.deporte === 'baloncesto'
        ? `Dif. ${sel.marcador_local}${Number(sel.marcador_visitante) >= 99 ? '+' : `-${sel.marcador_visitante}`} pts`
        : `Marcador ${sel.marcador_local}-${sel.marcador_visitante}`);
    }
    if (sel.detalle_fin) extras.push(DETALLE_IMPRESION[sel.detalle_fin] ?? sel.detalle_fin);
    if (extras.length) cmds += `  ${extras.join(' / ')}\n`;
    const cuotaSel = Number(sel.cuota_aplicada) * Number(sel.cuota_marcador ?? 1) * Number(sel.cuota_detalle ?? 1);
    cmds += _pad('  Cuota:', `x${cuotaSel.toFixed(2)}`);
  }

  cmds += LINE;
  cmds += _pad('Cuota combinada:', `x${Number(cuota_combinada).toFixed(2)}`);
  cmds += LINE;
  cmds += _pad('Apostado USD:', `$${Number(monto_apostado_usd).toFixed(2)}`);
  cmds += _pad('Apostado Bs:', `Bs ${Number(monto_apostado_bs).toFixed(2)}`);
  cmds += _pad('Tasa BCV:', `${Number(tasa_bcv_dia).toFixed(2)} Bs/$`);
  cmds += _pad('Moneda pago:', moneda_pago ?? 'USD');
  cmds += LINE;
  cmds += ALIGN_CENTER + BOLD_ON + FONT_LARGE;
  cmds += `GANA: $${Number(ganancia_potencial_usd).toFixed(2)}\n`;
  cmds += `      Bs ${Number(ganancia_potencial_bs).toFixed(2)}\n`;
  cmds += FONT_NORMAL + BOLD_OFF + ALIGN_LEFT;
  cmds += LINE;
  cmds += `Estado: ${estado ?? 'PENDIENTE'}\n`;
  cmds += '\n';
  cmds += 'Firma/Sello del bodeguero:\n';
  cmds += '\n\n';
  cmds += '_______________________________\n';
  cmds += '\n';
  cmds += ALIGN_CENTER;
  cmds += 'Premio valido 48h desde el\n';
  cmds += 'resultado del ultimo evento.\n';
  cmds += LINE;
  cmds += '\n\n\n';   // avance para que el corte no se coma el texto
  cmds += CUT;

  return cmds;
}

function generarPaginaPrueba(nombreImpresora) {
  let cmds = INIT + ALIGN_CENTER + BOLD_ON + 'TuParley\n' + BOLD_OFF;
  cmds += 'Prueba de impresion\n' + LINE + ALIGN_LEFT;
  cmds += `Impresora: ${_ascii(nombreImpresora ?? '')}\n`;
  cmds += `Fecha    : ${_ascii(new Date().toLocaleString('es-VE'))}\n`;
  cmds += _pad('Izquierda', 'Derecha');
  cmds += LINE + ALIGN_CENTER + 'Si lees esto, la impresora\nesta lista.\n\n\n\n' + CUT;
  return cmds;
}

function _stringToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xFF;
  return bytes;
}

function _chunk(bytes, size) {
  const partes = [];
  for (let i = 0; i < bytes.length; i += size) partes.push(bytes.slice(i, i + size));
  return partes;
}

function _delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let usbDevice       = null;
let usbEndpointOut  = null;
let btDevice        = null;
let btCharacteristic = null;

function _resetUSB() { usbDevice = null; usbEndpointOut = null; }
function _resetBT()  { btDevice = null; btCharacteristic = null; }

// Busca el endpoint de salida, prefiriendo la interfaz de clase impresora (0x07)
function _buscarSalidaUSB(device) {
  const candidatos = [];
  for (const iface of device.configuration?.interfaces ?? []) {
    for (const alt of iface.alternates) {
      const out = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk')
        ?? alt.endpoints.find((e) => e.direction === 'out');
      if (out) candidatos.push({ iface, alt, out, prioridad: alt.interfaceClass === 7 ? 0 : 1 });
    }
  }
  candidatos.sort((a, b) => a.prioridad - b.prioridad);
  return candidatos[0] ?? null;
}

async function _abrirUSB(device) {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  const salida = _buscarSalidaUSB(device);
  if (!salida) {
    await device.close();
    throw new Error('No se encontró un endpoint de salida USB en esta impresora.');
  }
  try {
    await device.claimInterface(salida.iface.interfaceNumber);
    if (salida.alt.alternateSetting !== 0) {
      await device.selectAlternateInterface(salida.iface.interfaceNumber, salida.alt.alternateSetting);
    }
  } catch (err) {
    await device.close().catch(() => {});
    throw new Error(
      'El sistema no permite usar esta impresora desde el navegador (otro programa o el driver la tiene ocupada). '
      + 'En Android funciona directo; en Windows instala el driver WinUSB con Zadig o usa Bluetooth. '
      + `Detalle: ${err.message}`,
    );
  }

  usbDevice      = device;
  usbEndpointOut = salida.out;
  device.addEventListener?.('disconnect', () => { if (usbDevice === device) _resetUSB(); });
  return { tipo: 'usb', nombre: device.productName ?? 'Impresora USB' };
}

async function conectarUSB() {
  if (!('usb' in navigator)) throw new Error('Este navegador no soporta WebUSB. Usa Chrome/Edge en Android o escritorio.');
  const device = await navigator.usb.requestDevice({ filters: [] });
  return _abrirUSB(device);
}

// Reconecta sin pedir permiso una impresora USB ya autorizada (al recargar la app)
async function reconectar() {
  if (usbDevice || btDevice || !('usb' in navigator)) return estado();
  try {
    const [device] = await navigator.usb.getDevices();
    if (device) await _abrirUSB(device);
  } catch {
    // Sin impresora autorizada o desconectada: se conecta manualmente
  }
  return estado();
}

async function _enviarUSB(bytes) {
  if (!usbDevice || !usbEndpointOut) throw new Error('Impresora USB no conectada.');
  for (const parte of _chunk(bytes, 4096)) {
    await usbDevice.transferOut(usbEndpointOut.endpointNumber, parte);
  }
}

async function conectarBluetooth() {
  if (!('bluetooth' in navigator)) throw new Error('Este navegador no soporta Web Bluetooth. Usa Chrome en Android o escritorio.');

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_SERVICIOS,
  });

  const server = await device.gatt.connect();
  let characteristic = null;
  for (const uuid of BLE_SERVICIOS) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars   = await service.getCharacteristics();
      characteristic = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write) ?? null;
      if (characteristic) break;
    } catch {
      // servicio no presente en esta impresora: probar el siguiente
    }
  }
  if (!characteristic) {
    device.gatt.disconnect();
    throw new Error('Esta impresora Bluetooth no expone un canal de impresión compatible (BLE). Si es Bluetooth clásico, conéctala por USB.');
  }

  btDevice         = device;
  btCharacteristic = characteristic;

  device.addEventListener('gattserverdisconnected', () => { if (btDevice === device) _resetBT(); });

  return { tipo: 'bluetooth', nombre: device.name ?? 'Impresora Bluetooth' };
}

async function _enviarBluetooth(bytes) {
  if (!btCharacteristic) throw new Error('Impresora Bluetooth no conectada.');
  const sinRespuesta = btCharacteristic.properties.writeWithoutResponse;
  // Paquetes de 100 bytes: cabe en el MTU de la mayoría de impresoras BLE
  for (const parte of _chunk(bytes, 100)) {
    if (sinRespuesta) await btCharacteristic.writeValueWithoutResponse(parte);
    else await btCharacteristic.writeValue(parte);
    await _delay(25);
  }
}

function estado() {
  if (usbDevice)  return { conectada: true,  tipo: 'usb',       nombre: usbDevice.productName ?? 'Impresora USB' };
  if (btDevice)   return { conectada: true,  tipo: 'bluetooth', nombre: btDevice.name ?? 'Impresora Bluetooth' };
  return { conectada: false, tipo: null, nombre: null };
}

async function desconectar() {
  if (usbDevice) { try { await usbDevice.close(); } catch { /* noop */ } _resetUSB(); }
  if (btDevice)  { try { btDevice.gatt.disconnect(); } catch { /* noop */ } _resetBT(); }
}

async function _enviar(comandos) {
  const bytes = _stringToBytes(comandos);
  // Tras recargar la página la conexión USB se pierde: reconectar la ya autorizada
  if (!usbDevice && !btCharacteristic) await reconectar();
  if (usbDevice)        return _enviarUSB(bytes);
  if (btCharacteristic) return _enviarBluetooth(bytes);
  throw new Error('No hay impresora conectada. Pulsa el icono de impresora en la barra superior.');
}

async function imprimirTicket(ticket) {
  return _enviar(generarComandosEscPos(ticket));
}

async function imprimirPrueba() {
  return _enviar(generarPaginaPrueba(estado().nombre));
}

export const printerService = {
  conectarUSB,
  conectarBluetooth,
  reconectar,
  desconectar,
  estado,
  imprimirTicket,
  imprimirPrueba,
  generarComandosEscPos,
};