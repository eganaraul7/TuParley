'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { verificarToken }  = require('../middlewares/auth.middleware');
const { limiterLogin, limiterApi } = require('../middlewares/rateLimiter.middleware');

router.post('/login',             limiterLogin, ctrl.login);
router.post('/logout',            verificarToken, ctrl.logout);
router.get ('/me',                verificarToken, ctrl.me);
router.post('/setup-2fa',         verificarToken, limiterApi, ctrl.setup2fa);
router.post('/verify-2fa',        verificarToken, limiterApi, ctrl.verify2fa);
router.post('/cambiar-contrasena',verificarToken, limiterApi, ctrl.cambiarContrasena);

module.exports = router;