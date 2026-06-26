const router = require('express').Router();
const { currentPeriod, isValidEmployeeName, normalizeName } = require('../helpers');
// ── GET /api/dashboard ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const p        = currentPeriod();
    const sections = await req.db.collection('sections')
      .find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const summaries = await Promise.all(sections.map(async (s) => {
      const sid   = s._id.toString();
      const now14 = new Date();
      now14.setDate(now14.getDate() + 14);
      const expiryCount = await req.db.collection('expiry_logs').countDocuments({
        sectionId: sid, removed: false, expiryDate: { $lte: now14 },
      });
      const orderCount = await req.db.collection('order_items')
        .countDocuments({ sectionId: sid, ordered: false });
      const cleaned = await req.db.collection('cleaning_logs')
        .findOne({ sectionId: sid, year: p.year, month: p.month, week: p.week });
      return { ...s, expiryCount, orderCount, cleanedThisWeek: !!cleaned };
    }));
    res.json({
      sections: summaries,
      summary: {
        expiryAlerts:   summaries.reduce((a, s) => a + s.expiryCount, 0),
        pendingOrders:  summaries.reduce((a, s) => a + s.orderCount, 0),
        cleansThisWeek: summaries.filter(s => s.cleanedThisWeek).length,
        totalSections:  sections.length,
      },
      currentPeriod: p,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── GET /api/dashboard/expiry-details ───────────────────
router.get('/expiry-details', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const sections = await req.db.collection('sections')
      .find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const now14 = new Date();
    now14.setDate(now14.getDate() + 14);
    const out = await Promise.all(sections.map(async (s) => {
      const items = await req.db.collection('expiry_logs')
        .find({ sectionId: s._id.toString(), removed: false, expiryDate: { $lte: now14 } })
        .sort({ expiryDate: 1 }).toArray();
      return { section: s, items };
    }));
    res.json(out.filter(d => d.items.length > 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── GET /api/dashboard/order-details ────────────────────
router.get('/order-details', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const sections = await req.db.collection('sections')
      .find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const out = await Promise.all(sections.map(async (s) => {
      const items = await req.db.collection('order_items')
        .find({ sectionId: s._id.toString(), ordered: false })
        .sort({ date: -1 }).toArray();
      return { section: s, items };
    }));
    res.json(out.filter(d => d.items.length > 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── GET /api/dashboard/cleaning-details ─────────────────
router.get('/cleaning-details', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const p        = currentPeriod();
    const sections = await req.db.collection('sections')
      .find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const out = await Promise.all(sections.map(async (s) => {
      const entry = await req.db.collection('cleaning_logs')
        .findOne({ sectionId: s._id.toString(), year: p.year, month: p.month, week: p.week });
      return { section: s, cleaned: !!entry, entry };
    }));
    res.json({ details: out, currentPeriod: p });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── GET /api/dashboard/planogram-details ────────────────
// FIX: was using Math.min(5, …) — now uses shared currentPeriod() (caps at 4)
router.get('/planogram-details', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const { year, month, week } = currentPeriod();
    const sections   = await req.db.collection('sections')
      .find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const sectionIds = sections.map(s => String(s._id));
    const logs = await req.db.collection('planogram_checks')
      .find({ sectionId: { $in: sectionIds }, year, month, week })
      .toArray();
    const logMap = {};
    logs.forEach(l => { logMap[l.sectionId] = l; });
    const details = sections.map(s => {
      const entry = logMap[String(s._id)] || null;
      return { section: s, checked: !!entry, entry };
    });
    res.json({ currentPeriod: { year, month, week }, details });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── GET /api/dashboard/section-health ───────────────────
router.get('/section-health', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const sections   = await req.db.collection('sections')
      .find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const sectionIds = sections.map(s => String(s._id));
    const lastCleans = await req.db.collection('cleaning_logs').aggregate([
      { $match: { sectionId: { $in: sectionIds } } },
      { $sort: { dateCleaned: -1 } },
      { $group: { _id: '$sectionId', doc: { $first: '$$ROOT' } } },
    ]).toArray();
    const lastPlanos = await req.db.collection('planogram_checks').aggregate([
      { $match: { sectionId: { $in: sectionIds } } },
      { $sort: { dateChecked: -1 } },
      { $group: { _id: '$sectionId', doc: { $first: '$$ROOT' } } },
    ]).toArray();
    const cleanMap = {};
    lastCleans.forEach(c => { cleanMap[c._id] = c.doc; });
    const planoMap = {};
    lastPlanos.forEach(p => { planoMap[p._id] = p.doc; });
    const MS_WEEK     = 7 * 24 * 60 * 60 * 1000;
    const now         = new Date();
    const NEVER_SCORE = 999;
    const health = sections.map(s => {
      const sid        = String(s._id);
      const lastClean  = cleanMap[sid] || null;
      const lastPlano  = planoMap[sid] || null;
      const cleanWeeks = lastClean
        ? Math.floor((now - new Date(lastClean.dateCleaned)) / MS_WEEK) : null;
      const planoWeeks = lastPlano
        ? Math.floor((now - new Date(lastPlano.dateChecked)) / MS_WEEK) : null;
      const cleanScore = cleanWeeks === null ? NEVER_SCORE : cleanWeeks;
      const planoScore = planoWeeks === null ? NEVER_SCORE : planoWeeks;
      return {
        section: s,
        cleaning:  { lastDate: lastClean?.dateCleaned || null, weeksSince: cleanWeeks, atRisk: cleanScore >= 2 },
        planogram: { lastDate: lastPlano?.dateChecked  || null, weeksSince: planoWeeks, atRisk: planoScore >= 2 },
        atRisk:      cleanScore >= 2 || planoScore >= 2,
        _cleanScore: cleanScore,
        _planoScore: planoScore,
      };
    });
    health.sort((a, b) => b._cleanScore - a._cleanScore || b._planoScore - a._planoScore);
    health.forEach(h => { delete h._cleanScore; delete h._planoScore; });
    res.json({ atRiskCount: health.filter(h => h.atRisk).length, sections: health });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── GET /api/dashboard/most-active-employee ─────────────
router.get('/most-active-employee', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const sections   = await req.db.collection('sections').find({ siteId }).toArray();
    const sectionIds = sections.map(s => String(s._id));
    const employees  = await req.db.collection('employees').find({ siteId }).toArray();
    const aliasMap = {};
    employees.forEach(emp =>
      (emp.aliases || []).forEach(a => { aliasMap[a] = emp.canonicalName; }),
    );
    const [cleanDocs, planoDocs, expiryDocs] = await Promise.all([
      req.db.collection('cleaning_logs')
        .find({ sectionId: { $in: sectionIds } }).project({ cleanedBy: 1 }).toArray(),
      req.db.collection('planogram_checks')
        .find({ sectionId: { $in: sectionIds } }).project({ checkedBy: 1 }).toArray(),
      req.db.collection('expiry_logs')
        .find({ sectionId: { $in: sectionIds } }).project({ signOffBy: 1 }).toArray(),
    ]);
    const counts = {};
    const resolve = (raw) => {
      if (!isValidEmployeeName(raw)) return null;
      const norm = normalizeName(raw);
      return aliasMap[norm] || raw.trim();
    };
    const tally = (arr, field) => {
      arr.forEach(d => {
        const canonical = resolve(d[field]);
        if (!canonical) return;
        const key = canonical.toLowerCase();
        if (!counts[key]) counts[key] = { name: canonical, count: 0 };
        counts[key].count++;
      });
    };
    tally(cleanDocs,  'cleanedBy');
    tally(planoDocs,  'checkedBy');
    tally(expiryDocs, 'signOffBy');
    const leaderboard = Object.values(counts).sort((a, b) => b.count - a.count);
    res.json({ topEmployee: leaderboard[0] || null, leaderboard: leaderboard.slice(0, 5) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;