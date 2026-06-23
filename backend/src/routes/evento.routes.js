'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/evento.controller');
const { verificarToken }                            = require('../middlewares/auth.middleware');
const { soloAdmin, bodegueroOAdmin, noDesconocido } = require('../middlewares/rol.middleware');
const { limiterApi }                                = require('../middlewares/rateLimiter.middleware');

router.use(verificarToken, noDesconocido, limiterApi);

// ── Estáticas ANTES de /:id ──────────────────────────────────────────────────
router.get ('/marcadores-en-vivo',            bodegueroOAdmin, ctrl.marcadoresEnVivo);
router.get ('/categorias/lista',              bodegueroOAdmin, ctrl.listarCategorias);
router.patch('/categorias/:deporte/toggle',   soloAdmin,       ctrl.toggleCategoria);
router.get ('/modalidades/lista',             bodegueroOAdmin, ctrl.listarModalidades);
router.patch('/modalidades/:id/toggle',       soloAdmin,       ctrl.toggleModalidad);
router.patch('/modalidades/:id/cuota',        soloAdmin,       ctrl.actualizarCuotaModalidad);

// ── CRUD eventos ─────────────────────────────────────────────────────────────
router.get ('/',        bodegueroOAdmin, ctrl.listarEventos);
router.post('/',        soloAdmin,       ctrl.crearEvento);
router.get ('/:id',     bodegueroOAdmin, ctrl.obtenerEvento);
router.put ('/:id',     soloAdmin,       ctrl.actualizarEvento);
router.patch('/:id/toggle', soloAdmin,   ctrl.toggleEvento);

module.exports = router;