const express = require('express');
const router = express.Router();
const SITES = require('../constants/sites');
router.get('/', (req, res) => res.json(SITES));
module.exports = router;