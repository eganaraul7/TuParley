'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/pago.controller');
const { verificarToken }             = require('../middlewares/auth.middleware');
const { bodegueroOAdmin }            = require('../middlewares/rol.middleware');
const { limiterApi }                 = require('../middlewares/rateLimiter.middleware');

router.use(verificarToken, bodegueroOAdmin, limiterApi);

router.get('/',                    ctrl.listarPagos);
router.get('/ticket/:ticketId',    ctrl.obtenerPagoPorTicket);
router.get('/:id',                 ctrl.obtenerPago);

module.exports = router;