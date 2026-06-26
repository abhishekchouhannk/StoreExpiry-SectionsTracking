const express = require('express');
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const { siteId, from, to } = req.query;
    if (!siteId || !from || !to) return res.status(400).json({ error: 'siteId, from, to required' });
    const db = req.db;
    const sections = await db.collection('sections').find({ siteId }).toArray();
    const fromDate = new Date(from + 'T00:00:00');
    const month = fromDate.getMonth() + 1;
    const year = fromDate.getFullYear();
    const week = Math.ceil(fromDate.getDate() / 7);
    const sectionIds = sections.map(s => s._id.toString());
    const cleaningLogs = await db.collection('cleaning_logs')
      .find({ sectionId: { $in: sectionIds }, year, month, week })
      .toArray();
    const cleaning = sections.map(section => {
      const entry = cleaningLogs.find(c => c.sectionId === section._id.toString());
      return { section: { name: section.name, icon: section.icon }, cleaned: !!entry, entry: entry || null };
    });
    const planogramLogs = await db.collection('planogram_checks')
      .find({ sectionId: { $in: sectionIds }, year, month, week })
      .toArray();
    const planogram = sections.map(section => {
      const entry = planogramLogs.find(p => p.sectionId === section._id.toString());
      return { section: { name: section.name, icon: section.icon }, checked: !!entry, entry: entry || null };
    });
    const expiry = await db.collection('expiry_logs')
      .find({ sectionId: { $in: sectionIds }, date: { $gte: from, $lte: to } })
      .sort({ expiryDate: 1 })
      .toArray();
    const orders = await db.collection('order_items')
      .find({ sectionId: { $in: sectionIds }, date: { $gte: from, $lte: to } })
      .sort({ date: -1 })
      .toArray();
    res.json({ sections, cleaning, planogram, expiry, orders });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;