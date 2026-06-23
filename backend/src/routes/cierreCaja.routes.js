'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/cierreCaja.controller');
const { verificarToken }             = require('../middlewares/auth.middleware');
const { soloAdmin, bodegueroOAdmin } = require('../middlewares/rol.middleware');
const { limiterApi }                 = require('../middlewares/rateLimiter.middleware');

router.use(verificarToken, limiterApi);

router.get ('/resumen', bodegueroOAdmin, ctrl.obtenerResumenCaja);
router.post('/',        bodegueroOAdmin, ctrl.cerrarCaja);
router.get ('/',        soloAdmin,       ctrl.listarCierres);
router.get ('/:id',     bodegueroOAdmin, ctrl.obtenerCierre);

module.exports = router;