'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/bodega.controller');
const { verificarToken }                              = require('../middlewares/auth.middleware');
const { soloAdmin, bodegueroOAdmin, noDesconocido }   = require('../middlewares/rol.middleware');
const { limiterApi }                                  = require('../middlewares/rateLimiter.middleware');

router.use(verificarToken, noDesconocido, limiterApi);

router.get  ('/',                            soloAdmin,       ctrl.listarBodegas);
router.get  ('/:id/config-impresion',        bodegueroOAdmin, ctrl.obtenerConfigImpresion);
router.patch('/:id/config-impresion',        bodegueroOAdmin, ctrl.actualizarConfigImpresion);

module.exports = router;