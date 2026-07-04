'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/ticket.controller');
const { verificarToken }                              = require('../middlewares/auth.middleware');
const { soloAdmin, bodegueroOAdmin, noDesconocido }   = require('../middlewares/rol.middleware');
const { limiterApi, limiterCrearTicket }              = require('../middlewares/rateLimiter.middleware');

router.use(verificarToken, noDesconocido, limiterApi);

// ── Estáticas ANTES de /:id ───────────────────────────────────────────────────
router.get  ('/buscar',                   bodegueroOAdmin, ctrl.buscarTicketPorSerie);
router.get  ('/qr/:serie',                bodegueroOAdmin, ctrl.consultarQR);
router.post ('/sync-offline',             bodegueroOAdmin, ctrl.sincronizarOffline);
router.get  ('/anulaciones',              soloAdmin,       ctrl.listarSolicitudesAnulacion);
router.patch('/anulaciones/:solicitudId', soloAdmin,       ctrl.responderAnulacion);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get  ('/',          bodegueroOAdmin,                    ctrl.listarTickets);
router.post ('/',          bodegueroOAdmin, limiterCrearTicket, ctrl.crearTicket);
router.get  ('/:id',       bodegueroOAdmin,                    ctrl.obtenerTicket);
router.patch('/:id/modo-impresion', bodegueroOAdmin,           ctrl.actualizarModoImpresion);
router.post ('/:id/solicitar-anulacion', bodegueroOAdmin,      ctrl.solicitarAnulacion);
router.post ('/:id/pagar', bodegueroOAdmin,                    ctrl.procesarPago);

module.exports = router;