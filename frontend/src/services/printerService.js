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

const BLE_SERVICE_UUID        = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const BLE_CHARACTERISTIC_UUID = '49535343-8841-43f4-a8d4-ecbe34729bb3';

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

function _pad(left, right, width = 32) {
  const espacios = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, espacios)) + right + '\n';
}

function generarComandosEscPos(ticket) {
  const {
    numero_serie, bodega_nombre, fecha_creacion, selecciones,
    cuota_combinada, monto_apostado_usd, monto_apostado_bs,
    ganancia_potencial_usd, ganancia_potencial_bs,
    tasa_bcv_dia, moneda_pago,
  } = ticket;

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

  for (const sel of (selecciones ?? [])) {
    cmds += BOLD_ON + `${sel.equipos ?? `${sel.equipo_local ?? ''} vs ${sel.equipo_visitante ?? ''}`}\n` + BOLD_OFF;
    cmds += `  ${sel.modalidad_nombre ?? ''}: ${sel.seleccion}\n`;
    cmds += _pad('  Cuota:', `x${Number(sel.cuota_aplicada).toFixed(2)}`);
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
  cmds += 'Estado: PENDIENTE\n';
  cmds += '\n';
  cmds += 'Firma/Sello del bodeguero:\n';
  cmds += '\n\n';
  cmds += '_______________________________\n';
  cmds += '\n';
  cmds += ALIGN_CENTER;
  cmds += 'Premio valido 48h desde el\n';
  cmds += 'resultado del ultimo evento.\n';
  cmds += LINE;
  cmds += CUT;

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

async function conectarUSB() {
  if (!('usb' in navigator)) throw new Error('Este navegador no soporta WebUSB. Usa Chrome/Edge en Android o escritorio.');

  const device = await navigator.usb.requestDevice({ filters: [] });
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  let endpointOut = null;
  let interfaceNumber = null;
  for (const conf of device.configurations) {
    for (const iface of conf.interfaces) {
      for (const alt of iface.alternates) {
        const out = alt.endpoints.find((e) => e.direction === 'out');
        if (out) { endpointOut = out; interfaceNumber = iface.interfaceNumber; break; }
      }
      if (endpointOut) break;
    }
    if (endpointOut) break;
  }
  if (!endpointOut) {
    await device.close();
    throw new Error('No se encontró un endpoint de salida USB en esta impresora.');
  }

  await device.claimInterface(interfaceNumber);

  usbDevice      = device;
  usbEndpointOut = endpointOut;

  device.addEventListener('disconnect', () => { if (usbDevice === device) _resetUSB(); });

  return { tipo: 'usb', nombre: device.productName ?? 'Impresora USB' };
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
    filters: [{ services: [BLE_SERVICE_UUID] }],
    optionalServices: [BLE_SERVICE_UUID],
  });

  const server         = await device.gatt.connect();
  const service        = await server.getPrimaryService(BLE_SERVICE_UUID);
  const characteristic  = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);

  btDevice         = device;
  btCharacteristic = characteristic;

  device.addEventListener('gattserverdisconnected', () => { if (btDevice === device) _resetBT(); });

  return { tipo: 'bluetooth', nombre: device.name ?? 'Impresora Bluetooth' };
}

async function _enviarBluetooth(bytes) {
  if (!btCharacteristic) throw new Error('Impresora Bluetooth no conectada.');
  for (const parte of _chunk(bytes, 180)) {
    await btCharacteristic.writeValueWithoutResponse(parte);
    await _delay(20);
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

async function imprimirTicket(ticket) {
  const bytes = _stringToBytes(generarComandosEscPos(ticket));
  if (usbDevice)      return _enviarUSB(bytes);
  if (btCharacteristic) return _enviarBluetooth(bytes);
  throw new Error('No hay impresora conectada. Pulsa el icono de impresora en la barra superior.');
}

export const printerService = {
  conectarUSB,
  conectarBluetooth,
  desconectar,
  estado,
  imprimirTicket,
};