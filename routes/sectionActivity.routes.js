const express = require('express');
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const { sectionId } = req.query;
    if (!sectionId) return res.status(400).json({ error: 'sectionId required' });
    const [cleanArr, planoArr, expiryArr, cleanTotal, planoTotal, expiryTotal] = await Promise.all([
      req.db.collection('cleaning_logs').find({ sectionId }).sort({ dateCleaned: -1 }).limit(1).toArray(),
      req.db.collection('planogram_checks').find({ sectionId }).sort({ dateChecked: -1 }).limit(1).toArray(),
      req.db.collection('expiry_logs').find({ sectionId }).sort({ date: -1 }).limit(1).toArray(),
      req.db.collection('cleaning_logs').countDocuments({ sectionId }),
      req.db.collection('planogram_checks').countDocuments({ sectionId }),
      req.db.collection('expiry_logs').countDocuments({ sectionId }),
    ]);
    res.json({
      cleaning: { last: cleanArr[0] || null, total: cleanTotal },
      planogram: { last: planoArr[0] || null, total: planoTotal },
      expiry: { last: expiryArr[0] || null, total: expiryTotal },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;