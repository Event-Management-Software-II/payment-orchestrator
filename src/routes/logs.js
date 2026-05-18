const express = require('express');
const router = express.Router();
const { listarLogs, leerArchivoLog } = require('../controllers/logController');

// Sin autenticación de empresa para uso interno/admin
router.get('/', listarLogs);
router.get('/archivo', leerArchivoLog);

module.exports = router;
