const router = require('express').Router();
// ── GET /api/weekly-report ──────────────────────────────
router.get('/weekly-report', async (req, res) => {
  try {
    const { siteId, from, to } = req.query;
    if (!siteId || !from || !to)
      return res.status(400).json({ error: 'siteId, from, to required' });
    const db       = req.db;
    const sections = await db.collection('sections').find({ siteId }).toArray();
    const sids     = sections.map(s => s._id.toString());
    const fromDate = new Date(from + 'T00:00:00');
    const toDate   = new Date(to   + 'T23:59:59.999');       // FIX: convert to Date
    const month    = fromDate.getMonth() + 1;
    const year     = fromDate.getFullYear();
    const week     = Math.min(Math.ceil(fromDate.getDate() / 7), 4); // FIX: cap at 4
    // Cleaning — one entry per section for this week
    const cleaningLogs = await db.collection('cleaning_logs')
      .find({ sectionId: { $in: sids }, year, month, week }).toArray();
    const cleaning = sections.map(section => {
      const entry = cleaningLogs.find(c => c.sectionId === section._id.toString());
      return {
        section: { name: section.name, icon: section.icon },
        cleaned: !!entry, entry: entry || null,
      };
    });
    // Planogram — one entry per section for this week
    const planogramLogs = await db.collection('planogram_checks')
      .find({ sectionId: { $in: sids }, year, month, week }).toArray();
    const planogram = sections.map(section => {
      const entry = planogramLogs.find(p => p.sectionId === section._id.toString());
      return {
        section: { name: section.name, icon: section.icon },
        checked: !!entry, entry: entry || null,
      };
    });
    // Expiry — items flagged during this week
    // FIX: compare Date objects instead of raw strings
    const expiry = await db.collection('expiry_logs')
      .find({ sectionId: { $in: sids }, date: { $gte: fromDate, $lte: toDate } })
      .sort({ expiryDate: 1 }).toArray();
    // Orders — orders added during this week
    // FIX: compare Date objects instead of raw strings
    const orders = await db.collection('order_items')
      .find({ sectionId: { $in: sids }, date: { $gte: fromDate, $lte: toDate } })
      .sort({ date: -1 }).toArray();
    res.json({ sections, cleaning, planogram, expiry, orders });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── GET /api/section-activity ───────────────────────────
router.get('/section-activity', async (req, res) => {
  try {
    const { sectionId } = req.query;
    if (!sectionId) return res.status(400).json({ error: 'sectionId required' });
    const [cleanArr, planoArr, expiryArr, cleanTotal, planoTotal, expiryTotal] =
      await Promise.all([
        req.db.collection('cleaning_logs')
          .find({ sectionId }).sort({ dateCleaned: -1 }).limit(1).toArray(),
        req.db.collection('planogram_checks')
          .find({ sectionId }).sort({ dateChecked: -1 }).limit(1).toArray(),
        req.db.collection('expiry_logs')
          .find({ sectionId }).sort({ date: -1 }).limit(1).toArray(),
        req.db.collection('cleaning_logs').countDocuments({ sectionId }),
        req.db.collection('planogram_checks').countDocuments({ sectionId }),
        req.db.collection('expiry_logs').countDocuments({ sectionId }),
      ]);
    res.json({
      cleaning:  { last: cleanArr[0]  || null, total: cleanTotal },
      planogram: { last: planoArr[0]  || null, total: planoTotal },
      expiry:    { last: expiryArr[0] || null, total: expiryTotal },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;