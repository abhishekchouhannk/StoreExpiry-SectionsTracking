const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Placeholder routes ──────────────────────────────────────
// These will be fleshed out once we wire up MongoDB Atlas

app.get('/api/sections', (req, res) => {
  res.json({ message: 'TODO: return all sections' });
});

app.get('/api/cleaning-logs', (req, res) => {
  res.json({ message: 'TODO: return cleaning logs', query: req.query });
});

app.get('/api/planogram-checks', (req, res) => {
  res.json({ message: 'TODO: return planogram checks', query: req.query });
});

app.get('/api/expiry-logs', (req, res) => {
  res.json({ message: 'TODO: return expiry logs', query: req.query });
});

app.get('/api/order-items', (req, res) => {
  res.json({ message: 'TODO: return order items', query: req.query });
});

// ── Serve index.html for anything unmatched ─────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Store Manager running at http://localhost:${PORT}`);
});