const router = require('express').Router();
const { ObjectId } = require('mongodb');
const { isValidEmployeeName } = require('../helpers');
router.get('/', async (req, res) => {
  try {
    const { sectionId, year, month } = req.query;
    const docs = await req.db.collection('planogram_checks')
      .find({ sectionId, year: +year, month: +month })
      .sort({ week: 1 }).toArray();
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { sectionId, year, month, week, dateChecked, checkedBy, comments, planogramFixed } = req.body;
    if (!isValidEmployeeName(checkedBy)) {
      return res.status(400).json({ error: 'Please enter a valid staff name (not blank, "-", or "Staff").' });
    }
    const exists = await req.db.collection('planogram_checks')
      .findOne({ sectionId, year: +year, month: +month, week: +week });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this week' });
    const doc = {
      sectionId, year: +year, month: +month, week: +week,
      dateChecked: new Date(dateChecked), checkedBy: checkedBy || '',
      comments: comments || '', planogramFixed: !!planogramFixed, createdAt: new Date(),
    };
    const r = await req.db.collection('planogram_checks').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('planogram_checks')
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;