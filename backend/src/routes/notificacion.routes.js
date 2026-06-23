'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/notificacion.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { soloAdmin }      = require('../middlewares/rol.middleware');
const { limiterApi }     = require('../middlewares/rateLimiter.middleware');

router.use(verificarToken, soloAdmin, limiterApi);

router.get ('/',              ctrl.listarNotificaciones);
router.get ('/conteo',        ctrl.conteoNoLeidas);
router.patch('/leer-todas',   ctrl.marcarTodasLeidas);
router.patch('/:id/leer',     ctrl.marcarLeida);
router.delete('/:id',         ctrl.eliminarNotificacion);

module.exports = router;