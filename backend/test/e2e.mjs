// Prueba de punta a punta contra el backend en ejecución y la BD LOCAL de desarrollo.
// ⚠️ Crea usuarios, eventos y tickets de prueba: NO ejecutar contra producción.
//
// Uso (con backend corriendo y la tasa BCV / BD locales):
//   PowerShell:  $env:ADMIN_PASS="<contraseña de computadora_madre>"; npm run test:e2e
//   cmd:         set ADMIN_PASS=<contraseña> && npm run test:e2e
// Variables opcionales: API (por defecto http://localhost:4000/api)
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const speakeasy = require('speakeasy');

if (!process.env.ADMIN_PASS) { console.error('Define ADMIN_PASS con la contraseña de computadora_madre'); process.exit(1); }
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost'].includes(DB_HOST)) {
  console.error('e2e solo se ejecuta contra una BD local de desarrollo'); process.exit(1);
}
const db = await mysql.createConnection({ host: DB_HOST, port: parseInt(process.env.DB_PORT || '3307', 10),
  user: process.env.DB_USER || 'tuparley_user', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'tuparley' });
await db.query("SET time_zone = '-04:00'");
const redis = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined, lazyConnect: true });
await redis.connect();

const B = process.env.API ?? 'http://localhost:4000/api';
let fallos = 0;
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function r(m, p, b, t) {
  for (let intento = 0; intento < 4; intento++) {
    const res = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
    let j; try { j = await res.json(); } catch { j = null; }
    // El limitador de creación de tickets (5 cada 10 s) es esperado: se reintenta
    if (res.status === 429 && p === '/tickets') { await esperar(10500); continue; }
    return { s: res.status, j };
  }
}
function ok(n, cond, info = '') { console.log((cond ? 'PASS' : 'FAIL').padEnd(5), n, cond ? '' : JSON.stringify(info).slice(0, 220)); if (!cond) fallos++; }
const vet = (min) => new Date(Date.now() + min * 60000 - 4 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
async function sql(q) { const [rows] = await db.query(q); return Array.isArray(rows) && rows[0] ? Object.values(rows[0])[0] : null; }
async function limpiarBloqueos() {
  await redis.del('bloqueado:1');
  const claves = await redis.keys('rl:login*');
  if (claves.length) await redis.del(...claves);
}

await limpiarBloqueos();
// ── Apuestas, liquidación, pagos, reembolsos, offline ─────────────────────────
const A=(await r('POST','/auth/login',{nombre_usuario:'computadora_madre',contrasena:process.env.ADMIN_PASS})).j.token;
ok('login admin',!!A);
await r('POST','/bcv/manual',{valor:150},A);
const nb='bod_'+crypto.randomBytes(3).toString('hex');
await r('POST','/usuarios',{nombre_usuario:nb,contrasena:'Prueba123!',rol:'bodeguero',bodega_id:1},A);
await sql(`DELETE FROM cierre_caja WHERE usuario_id=(SELECT id FROM usuarios WHERE nombre_usuario='${nb}')`);
const lb=await r('POST','/auth/login',{nombre_usuario:nb,contrasena:'Prueba123!'});
const T=lb.j?.token; ok('login bodeguero',!!T,lb);
const mkEv=async(dep,min,fase='amistoso')=>(await r('POST','/eventos',{deporte:dep,liga:'Liga E2E',equipo_local:'L'+min,equipo_visitante:'V'+min,fecha_inicio:vet(min),tipo_fase:fase},A)).j.evento_id;
const mods=(await r('GET','/eventos/modalidades/lista?deporte=futbol',null,T)).j.modalidades;
ok('modalidades incluyen tipo_resultado_btn',mods.some(m=>m.tipo_resultado_btn==='local'));
const mLocal=mods.find(m=>m.tipo_resultado_btn==='local'), mEmp=mods.find(m=>m.tipo_resultado_btn==='empate'), mLegacy=mods.find(m=>!m.tipo_resultado_btn);
const e1=await mkEv('futbol',60), e2=await mkEv('futbol',61,'eliminatoria'), ePast=await mkEv('futbol',-5);
let x=await r('POST','/tickets',{selecciones:[{evento_id:e1,modalidad_id:mLegacy.id,seleccion:'x'}],monto_apostado_usd:2,moneda_pago:'USD'},T);
ok('rechaza modalidad antigua',x.s===400,x);
x=await r('POST','/tickets',{selecciones:[{evento_id:ePast,modalidad_id:mLocal.id}],monto_apostado_usd:2,moneda_pago:'USD'},T);
ok('rechaza evento ya iniciado',x.s===409,x);
x=await r('POST','/tickets',{selecciones:[{evento_id:e1,modalidad_id:mLocal.id,marcador_local:0,marcador_visitante:1}],monto_apostado_usd:2,moneda_pago:'USD'},T);
ok('rechaza marcador incoherente',x.s===400,x);
x=await r('POST','/tickets',{selecciones:[{evento_id:e1,modalidad_id:mLocal.id,marcador_local:2,marcador_visitante:1,cuota_aplicada:99}],monto_apostado_usd:2,moneda_pago:'USD'},T);
ok('crea ticket con marcador (cuota del servidor 1.40*7=9.8)',x.s===201&&x.j.ticket.cuota_combinada===9.8,x);
const t1=x.j?.ticket;
x=await r('POST','/tickets',{selecciones:[{evento_id:e1,modalidad_id:mLocal.id},{evento_id:e2,modalidad_id:mEmp.id,detalle_fin:'penales'}],monto_apostado_usd:5,moneda_pago:'BS'},T);
ok('parlay local + empate/penales (1.4*3.2*2.5=11.2)',x.s===201&&x.j.ticket.cuota_combinada===11.2,x);
const t2=x.j?.ticket;
x=await r('POST','/tickets',{selecciones:[{evento_id:e1,modalidad_id:mLocal.id,marcador_local:5,marcador_visitante:0}],monto_apostado_usd:20,moneda_pago:'USD'},T);
ok('rechaza ganancia > tope',x.s===400&&x.j.monto_maximo,x);
// pasar a en_curso y liquidar
await sql(`UPDATE eventos SET fecha_inicio=NOW()-INTERVAL 2 HOUR, estado='en_curso' WHERE id IN (${e1},${e2})`);
x=await r('GET','/eventos/resultados/pendientes',null,A);
ok('pendientes de resultado lista eventos',x.s===200&&x.j.eventos.some(e=>e.id===e1),x);
x=await r('PATCH',`/eventos/${e1}/resultado`,{marcador_local:2,marcador_visitante:1},A);
ok('resultado manual e1 2-1',x.s===200&&x.j.liquidacion.resueltas>=2,x);
let d=(await r('GET',`/tickets/${t1.id}`,null,T)).j;
ok('ticket marcador exacto GANADO',d.ticket.estado==='GANADO',d.ticket.estado);
x=await r('PATCH',`/eventos/${e2}/resultado`,{marcador_local:1,marcador_visitante:1},A);
d=(await r('GET',`/tickets/${t2.id}`,null,T)).j;
ok('empate sin penales → parlay PERDIDO',d.ticket.estado==='PERDIDO',d.ticket.estado);
// pagar
x=await r('POST',`/tickets/${t1.id}/pagar`,{moneda:'BS'},T);
ok('pagar premio',x.s===200,x);
x=await r('POST',`/tickets/${t1.id}/pagar`,{moneda:'BS'},T);
ok('segundo pago rechazado 409',x.s===409,x);
// pagos concurrentes en otro ticket ganado
const e3=await mkEv('baloncesto',70);
const bmods=(await r('GET','/eventos/modalidades/lista?deporte=baloncesto',null,T)).j.modalidades;
const bv=bmods.find(m=>m.tipo_resultado_btn==='visitante');
x=await r('POST','/tickets',{selecciones:[{evento_id:e3,modalidad_id:bv.id,marcador_local:6,marcador_visitante:10}],monto_apostado_usd:3,moneda_pago:'USD'},T);
ok('baloncesto visitante rango 6-10',x.s===201,x); const t3=x.j?.ticket;
await sql(`UPDATE eventos SET fecha_inicio=NOW()-INTERVAL 3 HOUR, estado='en_curso' WHERE id=${e3}`);
await r('PATCH',`/eventos/${e3}/resultado`,{marcador_local:90,marcador_visitante:98},A);
d=(await r('GET',`/tickets/${t3.id}`,null,T)).j; ok('baloncesto margen 8 → GANADO',d.ticket.estado==='GANADO',d.ticket.estado);
const par=await Promise.all([1,2,3].map(()=>r('POST',`/tickets/${t3.id}/pagar`,{},T)));
ok('3 pagos simultáneos → 1 OK, 2 rechazados',par.filter(p=>p.s===200).length===1&&par.filter(p=>p.s===409).length===2,par.map(p=>p.s));
// suspensión + reembolso
const e4=await mkEv('futbol',80);
x=await r('POST','/tickets',{selecciones:[{evento_id:e4,modalidad_id:mLocal.id}],monto_apostado_usd:4,moneda_pago:'USD'},T); const t4=x.j.ticket;
x=await r('PUT',`/eventos/${e4}`,{estado:'suspendido'},A);
d=(await r('GET',`/tickets/${t4.id}`,null,T)).j; ok('evento suspendido → ticket SUSPENDIDO',d.ticket.estado==='SUSPENDIDO',d.ticket.estado);
x=await r('POST',`/tickets/${t4.id}/reembolsar`,{},T); ok('reembolso',x.s===200&&x.j.reembolso.monto_usd===4,x);
x=await r('POST',`/tickets/${t4.id}/reembolsar`,{},T); ok('reembolso duplicado rechazado',x.s===409,x);
// MMA sin método → manual
const e5=await mkEv('mma',90);
const mm=(await r('GET','/eventos/modalidades/lista?deporte=mma',null,T)).j.modalidades.find(m=>m.tipo_resultado_btn==='local');
x=await r('POST','/tickets',{selecciones:[{evento_id:e5,modalidad_id:mm.id,detalle_fin:'ko'}],monto_apostado_usd:2,moneda_pago:'USD'},T); const t5=x.j.ticket;
ok('MMA local KO (1.4*2.2=3.08)',x.s===201&&t5.cuota_combinada===3.08,x);
await sql(`UPDATE eventos SET fecha_inicio=NOW()-INTERVAL 1 HOUR, estado='en_curso' WHERE id=${e5}`);
x=await r('PATCH',`/eventos/${e5}/resultado`,{ganador:'local'},A);
d=(await r('GET',`/tickets/${t5.id}`,null,T)).j; ok('MMA sin método → sigue PENDIENTE (manual)',d.ticket.estado==='PENDIENTE'&&x.j.liquidacion.sinDatos===1,[d.ticket.estado,x.j]);
x=await r('PATCH',`/eventos/${e5}/resultado`,{ganador:'local',detalle_fin:'ko'},A);
d=(await r('GET',`/tickets/${t5.id}`,null,T)).j; ok('MMA con método KO → GANADO',d.ticket.estado==='GANADO',d.ticket.estado);
// offline
const e6=await mkEv('futbol',100);
const me=(await r('GET','/auth/me',null,T)).j.usuario;
const serie=`${me.bodega_prefijo}-${1000+Math.floor(Math.random()*8999)}-${1000+Math.floor(Math.random()*8999)}`;
const mkOff=(cuota,extra={})=>{const ts=Date.now();const sels=[{evento_id:e6,modalidad_id:mLocal.id,cuota_aplicada:1.4}];const base={numero_serie:extra.serie??serie,bodega_id:extra.bodega_id??me.bodega_id,usuario_id:me.id,monto_apostado_usd:2,cuota_combinada:cuota,selecciones:sels,ts};const ss=JSON.stringify(sels.map(s=>({evento_id:s.evento_id,modalidad_id:s.modalidad_id,cuota_aplicada:s.cuota_aplicada})));const h=crypto.createHash('sha256').update([base.numero_serie,base.bodega_id,base.usuario_id,2,cuota,ss,ts].join('|')).digest('hex');return {...base,hash_sha256:h,moneda_pago:'USD'}};
x=await r('POST','/tickets/sync-offline',{cola:[mkOff(50,{serie:serie.replace(/-\d{4}$/,'-0001')})]},T);
ok('offline con cuota inflada rechazado',x.j.resultados[0].estado==='rechazado',x.j);
x=await r('POST','/tickets/sync-offline',{cola:[mkOff(1.4,{bodega_id:999,serie:serie.replace(/-\d{4}$/,'-0002')})]},T);
ok('offline de otra bodega rechazado',x.j.resultados[0].estado==='rechazado',x.j);
x=await r('POST','/tickets/sync-offline',{cola:[mkOff(1.4)]},T);
ok('offline válido sincronizado',x.j.resultados[0].estado==='sincronizado',x.j);
x=await r('POST','/tickets/sync-offline',{cola:[mkOff(1.4)]},T);
ok('offline repetido → ya_existe',x.j.resultados[0].estado==='ya_existe',x.j);
// anulación sobre ticket pagado
x=await r('POST',`/tickets/${t3.id}/solicitar-anulacion`,{motivo:'prueba'},T);
ok('no se puede pedir anulación de ticket PAGADO',x.s===409,x);
const e7=await mkEv('futbol',120);
x=await r('POST','/tickets',{selecciones:[{evento_id:e7,modalidad_id:mLocal.id}],monto_apostado_usd:2,moneda_pago:'USD'},T); const t7=x.j.ticket;
x=await r('POST',`/tickets/${t7.id}/solicitar-anulacion`,{motivo:'error del cliente'},T);
const solId=x.j.solicitud_id;
x=await r('PATCH',`/tickets/anulaciones/${solId}`,{decision:'aprobada'},A);
d=(await r('GET',`/tickets/${t7.id}`,null,T)).j; ok('anulación aprobada → ANULADO',x.s===200&&d.ticket.estado==='ANULADO',[x,d.ticket.estado]);
// historial
x=await r('GET',`/tickets?page=1&limit=5&serie=${t1.numero_serie}`,null,T);
ok('historial filtra por serie y devuelve total',x.j.total===1&&x.j.tickets.length===1,x.j);
x=await r('GET','/cierre-caja/resumen',null,T); ok('resumen caja',x.s===200,x);

// ── Sesiones, jerarquía y 2FA ─────────────────────────────────────────────────
const M=(await r('POST','/auth/login',{nombre_usuario:'computadora_madre',contrasena:process.env.ADMIN_PASS})).j.token;
const sfx=Date.now()%100000;
const ad=`adm_${sfx}`, bo=`bod3_${sfx}`;
await r('POST','/usuarios',{nombre_usuario:ad,contrasena:'Admin1234!',rol:'administrador'},M);
const nbo=(await r('POST','/usuarios',{nombre_usuario:bo,contrasena:'Prueba123!',rol:'bodeguero',bodega_id:1},M)).j.usuario.id;
const AD=(await r('POST','/auth/login',{nombre_usuario:ad,contrasena:'Admin1234!'})).j.token;
ok('login admin secundario',!!AD);
const T1=(await r('POST','/auth/login',{nombre_usuario:bo,contrasena:'Prueba123!'})).j.token;
const T2=(await r('POST','/auth/login',{nombre_usuario:bo,contrasena:'Prueba123!'})).j.token;
ok('token de login anterior rechazado',(await r('GET','/auth/me',null,T1)).s===401);
ok('token del último login válido',(await r('GET','/auth/me',null,T2)).s===200);
await r('PATCH',`/usuarios/${nbo}/bloquear`,{},AD);
ok('bloquear cierra la sesión al instante',(await r('GET','/auth/me',null,T2)).s===401);
await r('PATCH',`/usuarios/${nbo}/desbloquear`,{},AD);
const T3=(await r('POST','/auth/login',{nombre_usuario:bo,contrasena:'Prueba123!'})).j.token;
await r('PATCH',`/usuarios/${nbo}/rol`,{rol:'desconocido'},AD);
ok('cambio de rol cierra la sesión',(await r('GET','/auth/me',null,T3)).s===401);
x=await r('PATCH','/usuarios/1/reset-contrasena',{contrasena_nueva:'Hackeo1234!'},AD); ok('admin no puede resetear a la madre',x.s===403,x);
x=await r('PATCH','/usuarios/1/rol',{rol:'desconocido'},AD); ok('admin no puede cambiar rol de la madre',x.s===403,x);
x=await r('PUT','/usuarios/1',{nombre_usuario:'otro'},AD); ok('admin no puede editar a la madre',x.s===403,x);
x=await r('PATCH',`/usuarios/${nbo}/reset-contrasena`,{contrasena_nueva:'Nueva12345!'},AD); ok('admin sí gestiona bodeguero',x.s===200,x);
const adId=await sql(`SELECT id FROM usuarios WHERE nombre_usuario='${ad}'`);
x=await r('PATCH',`/usuarios/${adId}/reset-contrasena`,{contrasena_nueva:'Admin1234!'},M); ok('madre sí gestiona admin',x.s===200,x);
// bloqueo temporal de la madre
for(let i=0;i<5;i++) x=await r('POST','/auth/login',{nombre_usuario:'computadora_madre',contrasena:'mala'});
ok('5 fallos madre → bloqueo temporal 429',x.s===429,x);
x=await r('POST','/auth/login',{nombre_usuario:'computadora_madre',contrasena:process.env.ADMIN_PASS}); ok('madre bloqueada temporalmente aun con clave correcta',x.s===429,x);
ok('madre NO queda bloqueada permanentemente en BD',String(await sql(`SELECT bloqueado FROM usuarios WHERE id=1`))==='0');
await limpiarBloqueos();
// 2FA con admin secundario
const AD2=(await r('POST','/auth/login',{nombre_usuario:ad,contrasena:'Admin1234!'})).j.token;
const st=(await r('POST','/auth/setup-2fa',{},AD2)).j; ok('setup 2FA devuelve secret',!!st.secret,st);
x=await r('POST','/auth/verify-2fa',{totp_code:speakeasy.totp({secret:st.secret,encoding:'base32'})},AD2); ok('verificación 2FA (enrollment)',x.s===200,x);
x=await r('POST','/auth/setup-2fa',{},AD2); ok('no se puede regenerar 2FA activo',x.s===409,x);
x=await r('POST','/auth/login',{nombre_usuario:ad,contrasena:'Admin1234!'}); ok('login pide 2FA',x.j.requiere_2fa===true,x);
const y=await r('POST','/auth/login/verify-2fa',{temp_token:x.j.temp_token,codigo_totp:speakeasy.totp({secret:st.secret,encoding:'base32'})}); ok('login completo con código 2FA',!!y.j.token,y);
x=await r('GET','/auth/me',null,y.j.token); ok('/me informa 2FA activo',x.j.usuario.totp_habilitado===true,x);

await db.end(); redis.disconnect();
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
