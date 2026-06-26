const router = require('express').Router();
const { ObjectId } = require('mongodb');
// ═════════════════════════════════════════════════════════
//  SHIFT CHECKLIST  (/api/checklist)
// ═════════════════════════════════════════════════════════
router.get('/checklist', async (req, res) => {
  try {
    const { siteId, from, to } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const q = { siteId, date: { $gte: from, $lte: to } };
    if (req.query.type) q.type = req.query.type;
    res.json(await req.db.collection('checklist_logs').find(q).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/checklist', async (req, res) => {
  try {
    const { siteId, date, task, shift, initials, type } = req.body;
    if (!siteId || !date || !task || !shift || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    const dupQuery = { siteId, date, task, shift };
    if (type) dupQuery.type = type;
    const exists = await req.db.collection('checklist_logs').findOne(dupQuery);
    if (exists) return res.status(400).json({ error: 'Entry already exists for this cell' });
    const doc = {
      siteId, date, task, shift,
      initials: initials.toUpperCase(), createdAt: new Date(),
    };
    if (type) doc.type = type;   // FIX: store type so GET filter & dedup work
    const r = await req.db.collection('checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/checklist/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } },
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/checklist/:id', async (req, res) => {
  try {
    await req.db.collection('checklist_logs')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ═════════════════════════════════════════════════════════
//  DAILY CHECKLIST  (/api/daily-checklist)
// ═════════════════════════════════════════════════════════
router.get('/daily-checklist', async (req, res) => {
  try {
    const { siteId, from, to } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    res.json(await req.db.collection('daily_checklist_logs')
      .find({ siteId, date: { $gte: from, $lte: to } }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/daily-checklist', async (req, res) => {
  try {
    const { siteId, date, task, initials } = req.body;
    if (!siteId || !date || !task || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    const exists = await req.db.collection('daily_checklist_logs')
      .findOne({ siteId, date, task });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this cell' });
    const doc = { siteId, date, task, initials: initials.toUpperCase(), createdAt: new Date() };
    const r   = await req.db.collection('daily_checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/daily-checklist/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('daily_checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } },
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/daily-checklist/:id', async (req, res) => {
  try {
    await req.db.collection('daily_checklist_logs')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ═════════════════════════════════════════════════════════
//  WEEKLY CHECKLIST  (/api/weekly-checklist)
// ═════════════════════════════════════════════════════════
router.get('/weekly-checklist', async (req, res) => {
  try {
    const { siteId, weekStart } = req.query;
    if (!siteId || !weekStart)
      return res.status(400).json({ error: 'siteId and weekStart required' });
    res.json(await req.db.collection('weekly_checklist_logs')
      .find({ siteId, weekStart }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/weekly-checklist', async (req, res) => {
  try {
    const { siteId, weekStart, task, initials } = req.body;
    if (!siteId || !weekStart || !task || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    const exists = await req.db.collection('weekly_checklist_logs')
      .findOne({ siteId, weekStart, task });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this task this week' });
    const doc = { siteId, weekStart, task, initials: initials.toUpperCase(), createdAt: new Date() };
    const r   = await req.db.collection('weekly_checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/weekly-checklist/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('weekly_checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } },
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/weekly-checklist/:id', async (req, res) => {
  try {
    await req.db.collection('weekly_checklist_logs')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;