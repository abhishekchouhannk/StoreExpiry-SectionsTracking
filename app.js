const express = require('express');
const path = require('path');
const attachDb = require('./middleware/attachDb');
const apiRoutes = require('./routes');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(attachDb);
app.use('/api', apiRoutes);
// ── Easter-egg claim ──
app.post('/api/easter-egg/claim', async (req, res) => {
  try {
    const { name, interacId, comments, earned } = req.body;
    if (!name || !interacId) return res.status(400).json({ error: 'Missing fields' });
    // Option A — just log it (simplest)
    console.log('🎉 EASTER EGG CLAIMED', { name, interacId, comments, earned, at: new Date() });
    // Option B — persist in Mongo (uncomment if you want a record)
    // await db.collection('easter_egg_claims').insertOne({
    //   name, interacId, comments, earned, claimedAt: new Date()
    // });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});
// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
module.exports = app;