const express = require('express');
const { listLogs, readLogFile } = require('../controllers/logController');

const router = express.Router();

router.get('/', listLogs);
router.get('/file', readLogFile);
router.get('/archivo', readLogFile);

module.exports = router;
