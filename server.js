require('dotenv').config();
const express = require('express');
const path = require('path');
const { getDb, seedIfNeeded } = require('./db');
const mountRoutes = require('./routes');
const app = express();
const PORT = process.env.PORT || 3000;
let seeded = false;
// ── Middleware ───────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Inject db + run seed before every request
app.use(async (req, res, next) => {
  try {
    const db = await getDb();
    if (!seeded) { await seedIfNeeded(db); seeded = true; }
    req.db = db;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }
});
// ── API Routes ──────────────────────────────────────────
mountRoutes(app);
// ── SPA Fallback ────────────────────────────────────────
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);
// ── Local dev server (not used by Vercel) ───────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}
module.exports = app;