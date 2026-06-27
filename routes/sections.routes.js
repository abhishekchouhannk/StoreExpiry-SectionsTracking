const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
router.get('/', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    res.json(await req.db.collection('sections').find({ siteId }).sort({ displayOrder: 1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const doc = await req.db.collection('sections').findOne({ _id: new ObjectId(req.params.id) });
    doc ? res.json(doc) : res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { name, icon, location, siteId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const n = await req.db.collection('sections').countDocuments({ siteId });
    const doc = { name, slug, icon: icon || '📦', location: location || '', displayOrder: n + 1, siteId, createdAt: new Date() };
    const r = await req.db.collection('sections').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await req.db.collection('sections').deleteOne({ _id: new ObjectId(id) });
    await Promise.all(['cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items']
      .map((c) => req.db.collection(c).deleteMany({ sectionId: id })));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/planogram-link', async (req, res) => {
  try {
    const { planogramFileId } = req.body;
    if (!planogramFileId) return res.status(400).json({ error: 'planogramFileId required' });
    await req.db.collection('sections').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { planogramFileId, planogramUpdatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;