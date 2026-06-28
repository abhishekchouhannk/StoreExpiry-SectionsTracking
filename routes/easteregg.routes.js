const express = require('express');
const router = express.Router();

// Check if already claimed
router.get('/money-claim', async (req, res) => {
  try {
    const claim = await req.db.collection('moneyClaim').findOne({ _id: 'the-prize' });
    if (claim) {
      return res.json({
        claimed: true,
        winner: { name: claim.name, claimedAt: claim.claimedAt },
      });
    }
    res.json({ claimed: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Submit a claim (first-come-first-serve, race-safe)
router.post('/money-claim', async (req, res) => {
  try {
    const { name, email, comments, amount } = req.body;
    if (!name || !email)
      return res.status(400).json({ error: 'Name and email are required.' });

    const result = await req.db.collection('moneyClaim').updateOne(
      { _id: 'the-prize' },
      { $setOnInsert: { name, email, comments, amount, claimedAt: new Date() } },
      { upsert: true }
    );

    if (result.upsertedCount === 0) {
      const existing = await req.db.collection('moneyClaim').findOne({ _id: 'the-prize' });
      return res.status(409).json({
        error: 'Already claimed',
        winner: { name: existing.name, claimedAt: existing.claimedAt },
      });
    }

    console.log(`🎉 MONEY CLAIMED by ${name} (${email}) — $${amount}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;