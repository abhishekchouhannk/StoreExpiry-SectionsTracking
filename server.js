require('dotenv').config();

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = process.env.DB_NAME || 'store_manager';
const PORT      = process.env.PORT    || 3000;

const SITES = [
  { id: 'C01158', name: '96 Shell' },
  { id: 'C01288', name: 'Riverside Shell' },
  { id: 'C09066', name: '72 Shell' },
];

// ── Cached connection ───────────────────────────────────
// Vercel serverless functions are short-lived. We cache the client
// on the module scope so warm invocations reuse the same connection
// instead of opening a new one on every request.
let cachedClient = null;
let cachedDb     = null;

async function getDb() {
  if (cachedDb) return cachedDb;
  const client = await MongoClient.connect(MONGO_URI);
  cachedClient = client;
  cachedDb     = client.db(DB_NAME);
  return cachedDb;
}

// ── Helper ──────────────────────────────────────────────
function currentPeriod() {
  const n = new Date();
  return {
    year:  n.getFullYear(),
    month: n.getMonth() + 1,
    week:  Math.min(Math.ceil(n.getDate() / 7), 4),
  };
}

// ── One-time seed/migration (runs on first cold start) ──
async function seedIfNeeded(db) {
  // Backfill any docs missing siteId → C01158
  const collections = ['sections', 'cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items'];
  for (const col of collections) {
    await db.collection(col).updateMany(
      { siteId: { $exists: false } },
      { $set: { siteId: 'C01158' } }
    );
  }
  // Seed default sections for C01158 if none exist
  const count = await db.collection('sections').countDocuments({ siteId: 'C01158' });
  if (count === 0) {
    await db.collection('sections').insertMany([
      { name: 'Chocolate',      slug: 'chocolate',      icon: '🍫', location: 'Aisle 3',   displayOrder: 1, siteId: 'C01158', createdAt: new Date() },
      { name: 'Novelty Candy',  slug: 'novelty-candy',  icon: '🍬', location: 'Aisle 4',   displayOrder: 2, siteId: 'C01158', createdAt: new Date() },
      { name: 'Meat Snacks',    slug: 'meat-snacks',    icon: '🥩', location: 'Aisle 5',   displayOrder: 3, siteId: 'C01158', createdAt: new Date() },
      { name: 'Candy Pegs',     slug: 'candy-pegs',     icon: '🍭', location: 'End Cap A', displayOrder: 4, siteId: 'C01158', createdAt: new Date() },
      { name: 'Chocolate Pegs', slug: 'chocolate-pegs', icon: '🍫', location: 'End Cap B', displayOrder: 5, siteId: 'C01158', createdAt: new Date() },
    ]);
  }
}

let seeded = false; // guard so seed only runs once per cold start

// ── Middleware ──────────────────────────────────────────
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

// ── Sites ───────────────────────────────────────────────
app.get('/api/sites', (req, res) => res.json(SITES));

// ═════════════════════════════════════════════════════════
//  SECTIONS
// ═════════════════════════════════════════════════════════
app.get('/api/sections', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    res.json(await req.db.collection('sections').find({ siteId }).sort({ displayOrder: 1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sections/:id', async (req, res) => {
  try {
    const doc = await req.db.collection('sections').findOne({ _id: new ObjectId(req.params.id) });
    doc ? res.json(doc) : res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sections', async (req, res) => {
  try {
    const { name, icon, location, siteId } = req.body;
    if (!name)   return res.status(400).json({ error: 'Name required' });
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const n    = await req.db.collection('sections').countDocuments({ siteId });
    const doc  = { name, slug, icon: icon || '📦', location: location || '', displayOrder: n + 1, siteId, createdAt: new Date() };
    const r    = await req.db.collection('sections').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sections/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await req.db.collection('sections').deleteOne({ _id: new ObjectId(id) });
    await Promise.all(['cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items']
      .map((c) => req.db.collection(c).deleteMany({ sectionId: id })));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═════════════════════════════════════════════════════════
//  DASHBOARD
// ═════════════════════════════════════════════════════════
app.get('/api/dashboard', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const p        = currentPeriod();
    const sections = await req.db.collection('sections').find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const summaries = await Promise.all(sections.map(async (s) => {
      const sid         = s._id.toString();
      const now14 = new Date(); now14.setDate(now14.getDate() + 14);
      const expiryCount = await req.db.collection('expiry_logs').countDocuments({
        sectionId: sid, removed: false,
        expiryDate: { $lte: now14 }
      });
      const orderCount  = await req.db.collection('order_items').countDocuments({ sectionId: sid, ordered: false });
      const cleaned     = await req.db.collection('cleaning_logs').findOne({ sectionId: sid, year: p.year, month: p.month, week: p.week });
      return { ...s, expiryCount, orderCount, cleanedThisWeek: !!cleaned };
    }));
    res.json({
      sections: summaries,
      summary: {
        expiryAlerts:   summaries.reduce((a, s) => a + s.expiryCount, 0),
        pendingOrders:  summaries.reduce((a, s) => a + s.orderCount, 0),
        cleansThisWeek: summaries.filter((s) => s.cleanedThisWeek).length,
        totalSections:  sections.length,
      },
      currentPeriod: p,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/expiry-details', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const sections = await req.db.collection('sections').find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const out = await Promise.all(sections.map(async (s) => {
      const items = await req.db.collection('expiry_logs')
        .find({ sectionId: s._id.toString(), removed: false, expiryDate: { $lte: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d; })() } })
        .sort({ expiryDate: 1 }).toArray();
      return { section: s, items };
    }));
    res.json(out.filter((d) => d.items.length > 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/order-details', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const sections = await req.db.collection('sections').find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const out = await Promise.all(sections.map(async (s) => {
      const items = await req.db.collection('order_items')
        .find({ sectionId: s._id.toString(), ordered: false }).sort({ date: -1 }).toArray();
      return { section: s, items };
    }));
    res.json(out.filter((d) => d.items.length > 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/cleaning-details', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const p        = currentPeriod();
    const sections = await req.db.collection('sections').find({ siteId }).sort({ displayOrder: 1 }).toArray();
    const out = await Promise.all(sections.map(async (s) => {
      const entry = await req.db.collection('cleaning_logs')
        .findOne({ sectionId: s._id.toString(), year: p.year, month: p.month, week: p.week });
      return { section: s, cleaned: !!entry, entry };
    }));
    res.json({ details: out, currentPeriod: p });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═════════════════════════════════════════════════════════
//  CLEANING LOGS
// ═════════════════════════════════════════════════════════
app.get('/api/cleaning-logs', async (req, res) => {
  try {
    const { sectionId, year, month } = req.query;
    res.json(await req.db.collection('cleaning_logs')
      .find({ sectionId, year: +year, month: +month }).sort({ week: 1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cleaning-logs', async (req, res) => {
  try {
    const { sectionId, year, month, week, dateCleaned, cleanedBy, comments } = req.body;
    const exists = await req.db.collection('cleaning_logs')
      .findOne({ sectionId, year: +year, month: +month, week: +week });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this week' });
    const doc = { sectionId, year: +year, month: +month, week: +week, dateCleaned: new Date(dateCleaned), cleanedBy: cleanedBy || '', comments: comments || '', createdAt: new Date() };
    const r   = await req.db.collection('cleaning_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cleaning-logs/:id', async (req, res) => {
  try {
    await req.db.collection('cleaning_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═════════════════════════════════════════════════════════
//  PLANOGRAM CHECKS
// ═════════════════════════════════════════════════════════
app.get('/api/planogram-checks', async (req, res) => {
  try {
    const { sectionId, year, month } = req.query;
    res.json(await req.db.collection('planogram_checks')
      .find({ sectionId, year: +year, month: +month }).sort({ week: 1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/planogram-checks', async (req, res) => {
  try {
    const { sectionId, year, month, week, dateChecked, checkedBy, comments, planogramFixed } = req.body;
    const exists = await req.db.collection('planogram_checks')
      .findOne({ sectionId, year: +year, month: +month, week: +week });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this week' });
    const doc = { sectionId, year: +year, month: +month, week: +week, dateChecked: new Date(dateChecked), checkedBy: checkedBy || '', comments: comments || '', planogramFixed: !!planogramFixed, createdAt: new Date() };
    const r   = await req.db.collection('planogram_checks').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/planogram-checks/:id', async (req, res) => {
  try {
    await req.db.collection('planogram_checks').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═════════════════════════════════════════════════════════
//  EXPIRY LOGS
// ═════════════════════════════════════════════════════════
app.get('/api/expiry-logs', async (req, res) => {
  try {
    const { sectionId, filter } = req.query;
    const q = { sectionId };
    if (filter === 'removed') q.removed = true;
    else if (filter === 'active') q.removed = false;
    res.json(await req.db.collection('expiry_logs').find(q).sort({ date: -1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/expiry-logs', async (req, res) => {
  try {
    const { sectionId, date, item, expiryDate, signOffBy, removed } = req.body;
    const doc = { sectionId, date: new Date(date), item: item || '', expiryDate: expiryDate ? new Date(expiryDate) : null, removed: !!removed, signOffBy: signOffBy || '', createdAt: new Date() };
    const r   = await req.db.collection('expiry_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/expiry-logs/:id', async (req, res) => {
  try {
    const u = {};
    if (req.body.removed   !== undefined) u.removed   = req.body.removed;
    if (req.body.signOffBy !== undefined) u.signOffBy = req.body.signOffBy;
    await req.db.collection('expiry_logs').updateOne({ _id: new ObjectId(req.params.id) }, { $set: u });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/expiry-logs/:id', async (req, res) => {
  try {
    await req.db.collection('expiry_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═════════════════════════════════════════════════════════
//  ORDER ITEMS
// ═════════════════════════════════════════════════════════
app.get('/api/order-items', async (req, res) => {
  try {
    const { sectionId, filter } = req.query;
    const q = { sectionId };
    if (filter === 'pending') q.ordered = false;
    else if (filter === 'ordered') q.ordered = true;
    res.json(await req.db.collection('order_items').find(q).sort({ date: -1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/order-items', async (req, res) => {
  try {
    const { sectionId, date, item, comments } = req.body;
    const doc = { sectionId, date: new Date(date), item: item || '', comments: comments || '', ordered: false, createdAt: new Date() };
    const r   = await req.db.collection('order_items').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/order-items/:id', async (req, res) => {
  try {
    const u = {};
    if (req.body.ordered !== undefined) u.ordered = req.body.ordered;
    await req.db.collection('order_items').updateOne({ _id: new ObjectId(req.params.id) }, { $set: u });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/order-items/:id', async (req, res) => {
  try {
    await req.db.collection('order_items').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ═════════════════════════════════════════════════════════
//  DAILY CHECKLIST
// ═════════════════════════════════════════════════════════
app.get('/api/checklist', async (req, res) => {
  try {
    const { siteId, from, to } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const q = { siteId, date: { $gte: from, $lte: to } };
    res.json(await req.db.collection('checklist_logs').find(q).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checklist', async (req, res) => {
  try {
    const { siteId, date, task, shift, initials } = req.body;
    if (!siteId || !date || !task || !shift || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    // Prevent duplicates
    const exists = await req.db.collection('checklist_logs').findOne({ siteId, date, task, shift });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this cell' });
    const doc = { siteId, date, task, shift, initials: initials.toUpperCase(), createdAt: new Date() };
    const r   = await req.db.collection('checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/checklist/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/checklist/:id', async (req, res) => {
  try {
    await req.db.collection('checklist_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Fallback (SPA) ──────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Local dev server (not used by Vercel) ──────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}

module.exports = app;