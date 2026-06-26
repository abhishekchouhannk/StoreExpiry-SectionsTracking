const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const month = req.query.month !== undefined ? parseInt(req.query.month, 10) : now.getMonth();
    const year = req.query.year !== undefined ? parseInt(req.query.year, 10) : now.getFullYear();
    const startDate = new Date(year, month, 1, 0, 0, 0);
    const endDate = new Date(year, month + 1, 1, 0, 0, 0);
    const logs = await req.db.collection('testwash_logs')
      .find({ issuedAt: { $gte: startDate, $lt: endDate } })
      .sort({ issuedAt: -1 })
      .toArray();
    res.json({ success: true, data: logs, month, year, count: logs.length });
  } catch (err) {
    console.error('Error fetching testwash logs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch testwash logs' });
  }
});
router.get('/months', async (req, res) => {
  try {
    const months = await req.db.collection('testwash_logs').aggregate([
      { $group: { _id: { year: { $year: '$issuedAt' }, month: { $month: '$issuedAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]).toArray();
    const formatted = months.map(m => ({ year: m._id.year, month: m._id.month - 1, count: m.count }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error fetching months list:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch months list' });
  }
});
router.post('/', async (req, res) => {
  try {
    const { carwashCode, issuedTo, issuedBy, date, time, notes } = req.body;
    if (!carwashCode || !issuedTo || !issuedBy || !date || !time) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }
    const issuedAt = new Date(`${date}T${time}`);
    if (isNaN(issuedAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date or time' });
    }
    const doc = { carwashCode, issuedTo, issuedBy, issuedAt, notes: notes || '', createdAt: new Date() };
    const result = await req.db.collection('testwash_logs').insertOne(doc);
    res.status(201).json({ success: true, data: { ...doc, _id: result.insertedId } });
  } catch (err) {
    console.error('Error creating testwash log:', err);
    res.status(500).json({ success: false, message: 'Failed to create testwash log' });
  }
});
router.put('/:id', async (req, res) => {
  try {
    const { carwashCode, issuedTo, issuedBy, date, time, notes } = req.body;
    const update = {};
    if (carwashCode !== undefined) update.carwashCode = carwashCode;
    if (issuedTo !== undefined) update.issuedTo = issuedTo;
    if (issuedBy !== undefined) update.issuedBy = issuedBy;
    if (notes !== undefined) update.notes = notes;
    if (date && time) {
      const issuedAt = new Date(`${date}T${time}`);
      if (isNaN(issuedAt.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date or time' });
      }
      update.issuedAt = issuedAt;
    }
    const result = await req.db.collection('testwash_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    res.json({ success: true, message: 'Log updated successfully' });
  } catch (err) {
    console.error('Error updating testwash log:', err);
    res.status(500).json({ success: false, message: 'Failed to update testwash log' });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const result = await req.db.collection('testwash_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    res.json({ success: true, message: 'Log deleted successfully' });
  } catch (err) {
    console.error('Error deleting testwash log:', err);
    res.status(500).json({ success: false, message: 'Failed to delete testwash log' });
  }
});
module.exports = router;