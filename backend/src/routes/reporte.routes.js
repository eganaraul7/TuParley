'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/reporte.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { soloAdmin }      = require('../middlewares/rol.middleware');
const { limiterApi }     = require('../middlewares/rateLimiter.middleware');

router.use(verificarToken, soloAdmin, limiterApi);

router.get('/diario',                  ctrl.reporteDiario);
router.get('/semanal',                 ctrl.reporteSemanal);
router.get('/mensual',                 ctrl.reporteMensual);
router.get('/estadisticas-mensuales',  ctrl.listarEstadisticasMensuales);
router.get('/pdf',                     ctrl.exportarPDF);
router.get('/word',                    ctrl.exportarWord);

module.exports = router;