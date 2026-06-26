const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { isValidEmployeeName, normalizeName, buildAutoAliases } = require('../utils/employeeName');
router.get('/', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const list = await req.db.collection('employees').find({ siteId }).sort({ canonicalName: 1 }).toArray();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { siteId, canonicalName, extraAliases } = req.body;
    if (!siteId || !canonicalName) return res.status(400).json({ error: 'siteId and canonicalName required' });
    if (!isValidEmployeeName(canonicalName)) return res.status(400).json({ error: 'Please enter a valid employee name' });
    const others = await req.db.collection('employees').find({ siteId }).toArray();
    const taken = new Set();
    others.forEach(o => (o.aliases || []).forEach(a => taken.add(a)));
    const proposed = new Set([
      ...buildAutoAliases(canonicalName),
      ...(extraAliases || []).map(normalizeName).filter(Boolean),
    ]);
    const warnings = [];
    const finalAliases = [];
    proposed.forEach(a => {
      if (taken.has(a)) warnings.push(`Alias "${a}" already used by another employee — skipped.`);
      else finalAliases.push(a);
    });
    const doc = { siteId, canonicalName: canonicalName.trim(), aliases: finalAliases, createdAt: new Date() };
    const r = await req.db.collection('employees').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId, warnings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const { canonicalName, extraAliases } = req.body;
    const existing = await req.db.collection('employees').findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!isValidEmployeeName(canonicalName)) return res.status(400).json({ error: 'Please enter a valid employee name' });
    const others = await req.db.collection('employees')
      .find({ siteId: existing.siteId, _id: { $ne: existing._id } }).toArray();
    const taken = new Set();
    others.forEach(o => (o.aliases || []).forEach(a => taken.add(a)));
    const proposed = new Set([
      ...buildAutoAliases(canonicalName),
      ...(extraAliases || []).map(normalizeName).filter(Boolean),
    ]);
    const warnings = [];
    const finalAliases = [];
    proposed.forEach(a => {
      if (taken.has(a)) warnings.push(`Alias "${a}" already used by another employee — skipped.`);
      else finalAliases.push(a);
    });
    await req.db.collection('employees').updateOne(
      { _id: existing._id },
      { $set: { canonicalName: canonicalName.trim(), aliases: finalAliases } }
    );
    res.json({ success: true, warnings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await req.db.collection('employees').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;