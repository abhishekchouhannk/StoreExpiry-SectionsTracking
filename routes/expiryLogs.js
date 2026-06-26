const router = require('express').Router();
const { ObjectId } = require('mongodb');
const { isValidEmployeeName } = require('../helpers');
router.get('/', async (req, res) => {
  try {
    const { sectionId, filter } = req.query;
    const q = { sectionId };
    if (filter === 'removed') q.removed = true;
    else if (filter === 'active') q.removed = false;
    const docs = await req.db.collection('expiry_logs')
      .find(q).sort({ expiryDate: 1, date: -1 }).toArray();
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { sectionId, date, item, expiryDate, signOffBy, removed } = req.body;
    if (!isValidEmployeeName(signOffBy)) {
      return res.status(400).json({ error: 'Please enter a valid staff name (not blank, "-", or "Staff").' });
    }
    const doc = {
      sectionId, date: new Date(date), item: item || '',
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      removed: !!removed, signOffBy: signOffBy || '', createdAt: new Date(),
    };
    const r = await req.db.collection('expiry_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const u = {};
    if (req.body.removed   !== undefined) u.removed   = req.body.removed;
    if (req.body.signOffBy !== undefined) u.signOffBy = req.body.signOffBy;
    await req.db.collection('expiry_logs')
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: u });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('expiry_logs')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;