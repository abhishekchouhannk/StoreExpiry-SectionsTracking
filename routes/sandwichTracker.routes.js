const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
router.get('/', async (req, res) => {
  try {
    const { siteId, weekStart } = req.query;
    if (!siteId || !weekStart) return res.status(400).json({ error: 'siteId and weekStart required' });
    res.json(await req.db.collection('sandwich_logs').find({ siteId, weekStart }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { siteId, weekStart, sandwich } = req.body;
    if (!siteId || !weekStart || !sandwich) return res.status(400).json({ error: 'Missing required fields' });
    const exists = await req.db.collection('sandwich_logs').findOne({ siteId, weekStart, sandwich });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this sandwich this week' });
    const doc = { ...req.body, createdAt: new Date() };
    const r = await req.db.collection('sandwich_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const { _id, createdAt, ...update } = req.body;
    await req.db.collection('sandwich_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('sandwich_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;