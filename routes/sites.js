const router = require('express').Router();
const { SITES } = require('../config');
router.get('/', (_req, res) => res.json(SITES));
module.exports = router;