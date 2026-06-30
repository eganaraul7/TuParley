'use strict';

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const compression = require('compression');

const authRoutes       = require('./routes/auth.routes');
const usuarioRoutes    = require('./routes/usuario.routes');
const ticketRoutes     = require('./routes/ticket.routes');
const eventoRoutes     = require('./routes/evento.routes');
const cierreCajaRoutes = require('./routes/cierreCaja.routes');
const pagoRoutes       = require('./routes/pago.routes');
const reporteRoutes    = require('./routes/reporte.routes');
const notificacionRoutes = require('./routes/notificacion.routes');


const app = express();

// ─── Seguridad y utilidades ───────────────────────────────────────────────────
const ORIGENES_PERMITIDOS = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: ORIGENES_PERMITIDOS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/usuarios',      usuarioRoutes);
app.use('/api/tickets',       ticketRoutes);
app.use('/api/eventos',       eventoRoutes);
app.use('/api/cierre-caja',   cierreCajaRoutes);
app.use('/api/pagos',         pagoRoutes);
app.use('/api/reportes',      reporteRoutes);
app.use('/api/notificaciones',notificacionRoutes);

// ─── BCV manual (admin) ───────────────────────────────────────────────────────
const { verificarToken }  = require('./middlewares/auth.middleware');
const { soloAdmin }       = require('./middlewares/rol.middleware');
const bcvService          = require('./services/bcv.service');
const { query }           = require('./config/db');

app.get('/api/bcv/actual', verificarToken, async (req, res) => {
  const tasa = await bcvService.obtenerTasaActual();
  return res.json({ tasa });
});

app.post('/api/bcv/manual', verificarToken, soloAdmin, async (req, res) => {
  const { valor } = req.body;
  try {
    const nuevo = await bcvService.setTasaManual(valor, req.usuario.id);
    req.app.get('io')?.emitirTodos('bcv_actualizada', { valor: nuevo });
    await query(
      `INSERT INTO auditoria_logs (usuario_id, accion, detalle) VALUES (?, 'bcv_manual', ?)`,
      [req.usuario.id, JSON.stringify({ valor: nuevo })]
    );
    return res.json({ mensaje: 'Tasa BCV actualizada manualmente', valor: nuevo });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ─── Modo mantenimiento ───────────────────────────────────────────────────────
const { setCache, getCache, delCache, KEYS } = require('./config/redis');

app.get('/api/admin/mantenimiento', verificarToken, soloAdmin, async (req, res) => {
  const activo = await getCache(KEYS.MANTENIMIENTO);
  return res.json({ activo: activo === '1' });
});

app.post('/api/admin/mantenimiento', verificarToken, soloAdmin, async (req, res) => {
  const { activo } = req.body;
  if (activo) {
    await setCache(KEYS.MANTENIMIENTO, '1', 86400);
    req.app.get('io')?.emitirTodos('mantenimiento', { activo: true });
  } else {
    await delCache(KEYS.MANTENIMIENTO);
    req.app.get('io')?.emitirTodos('mantenimiento', { activo: false });
  }
  return res.json({ mantenimiento: activo });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── Frontend (build de producción) ──────────────────────────────────────────
const path        = require('path');
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (req, res, next) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => { if (err) next(); });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` }));

// ─── Error global ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[app] Error no manejado:', err);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;