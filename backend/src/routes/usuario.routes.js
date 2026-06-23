'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/usuario.controller');
const { verificarToken }                    = require('../middlewares/auth.middleware');
const { soloAdmin, bodegueroOAdmin }        = require('../middlewares/rol.middleware');
const { limiterApi }                        = require('../middlewares/rateLimiter.middleware');

router.use(verificarToken, limiterApi);

router.get ('/',                                    soloAdmin, ctrl.listarUsuarios);
router.post('/',                                    soloAdmin, ctrl.crearUsuario);
router.get ('/solicitudes-reingreso',               soloAdmin, ctrl.listarSolicitudesReingreso);
router.patch('/solicitudes-reingreso/:id',          soloAdmin, ctrl.responderSolicitudReingreso);
router.get ('/:id',                                 bodegueroOAdmin, ctrl.obtenerUsuario);
router.put ('/:id',                                 soloAdmin, ctrl.actualizarUsuario);
router.patch('/:id/rol',                            soloAdmin, ctrl.asignarRol);
router.patch('/:id/bloquear',                       soloAdmin, ctrl.bloquearUsuario);
router.patch('/:id/desbloquear',                    soloAdmin, ctrl.desbloquearUsuario);
router.patch('/:id/reset-contrasena',               soloAdmin, ctrl.resetContrasena);
router.delete('/:id',                               soloAdmin, ctrl.eliminarUsuario);

module.exports = router;