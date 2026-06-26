const express = require('express');
const { ObjectId } = require('mongodb');
// ---- Shift checklist ----
const shiftRouter = express.Router();
shiftRouter.get('/', async (req, res) => {
  try {
    const { siteId, from, to } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const q = { siteId, date: { $gte: from, $lte: to } };
    if (req.query.type) q.type = req.query.type;
    res.json(await req.db.collection('checklist_logs').find(q).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
shiftRouter.post('/', async (req, res) => {
  try {
    const { siteId, date, task, shift, initials } = req.body;
    if (!siteId || !date || !task || !shift || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    const dupQuery = { siteId, date, task, shift };
    if (req.body.type) dupQuery.type = req.body.type;
    const exists = await req.db.collection('checklist_logs').findOne(dupQuery);
    if (exists) return res.status(400).json({ error: 'Entry already exists for this cell' });
    const doc = { siteId, date, task, shift, initials: initials.toUpperCase(), createdAt: new Date() };
    const r = await req.db.collection('checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
shiftRouter.put('/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
shiftRouter.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('checklist_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ---- Daily checklist ----
const dailyRouter = express.Router();
dailyRouter.get('/', async (req, res) => {
  try {
    const { siteId, from, to } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    res.json(await req.db.collection('daily_checklist_logs')
      .find({ siteId, date: { $gte: from, $lte: to } }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
dailyRouter.post('/', async (req, res) => {
  try {
    const { siteId, date, task, initials } = req.body;
    if (!siteId || !date || !task || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    const exists = await req.db.collection('daily_checklist_logs').findOne({ siteId, date, task });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this cell' });
    const doc = { siteId, date, task, initials: initials.toUpperCase(), createdAt: new Date() };
    const r = await req.db.collection('daily_checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
dailyRouter.put('/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('daily_checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
dailyRouter.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('daily_checklist_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ---- Weekly checklist ----
const weeklyRouter = express.Router();
weeklyRouter.get('/', async (req, res) => {
  try {
    const { siteId, weekStart } = req.query;
    if (!siteId || !weekStart) return res.status(400).json({ error: 'siteId and weekStart required' });
    res.json(await req.db.collection('weekly_checklist_logs').find({ siteId, weekStart }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
weeklyRouter.post('/', async (req, res) => {
  try {
    const { siteId, weekStart, task, initials } = req.body;
    if (!siteId || !weekStart || !task || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    const exists = await req.db.collection('weekly_checklist_logs').findOne({ siteId, weekStart, task });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this task this week' });
    const doc = { siteId, weekStart, task, initials: initials.toUpperCase(), createdAt: new Date() };
    const r = await req.db.collection('weekly_checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
weeklyRouter.put('/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('weekly_checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
weeklyRouter.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('weekly_checklist_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = { shiftRouter, dailyRouter, weeklyRouter };