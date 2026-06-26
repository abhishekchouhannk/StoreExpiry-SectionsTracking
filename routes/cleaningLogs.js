const router = require('express').Router();
const { ObjectId } = require('mongodb');
const { isValidEmployeeName } = require('../helpers');
router.get('/', async (req, res) => {
  try {
    const { sectionId, year, month } = req.query;
    const docs = await req.db.collection('cleaning_logs')
      .find({ sectionId, year: +year, month: +month })
      .sort({ week: 1 }).toArray();
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { sectionId, year, month, week, dateCleaned, cleanedBy, comments } = req.body;
    if (!isValidEmployeeName(cleanedBy)) {
      return res.status(400).json({ error: 'Please enter a valid staff name (not blank, "-", or "Staff").' });
    }
    const exists = await req.db.collection('cleaning_logs')
      .findOne({ sectionId, year: +year, month: +month, week: +week });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this week' });
    const doc = {
      sectionId, year: +year, month: +month, week: +week,
      dateCleaned: new Date(dateCleaned), cleanedBy: cleanedBy || '',
      comments: comments || '', createdAt: new Date(),
    };
    const r = await req.db.collection('cleaning_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('cleaning_logs')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;