const router = require('express').Router();
const { ObjectId } = require('mongodb');
router.get('/', async (req, res) => {
  try {
    const { sectionId, filter } = req.query;
    const q = { sectionId };
    if (filter === 'pending')  q.ordered = false;
    else if (filter === 'ordered') q.ordered = true;
    const docs = await req.db.collection('order_items')
      .find(q).sort({ date: -1 }).toArray();
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { sectionId, date, item, comments } = req.body;
    const doc = {
      sectionId, date: new Date(date), item: item || '',
      comments: comments || '', ordered: false, createdAt: new Date(),
    };
    const r = await req.db.collection('order_items').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const u = {};
    if (req.body.ordered !== undefined) u.ordered = req.body.ordered;
    await req.db.collection('order_items')
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: u });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('order_items')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;