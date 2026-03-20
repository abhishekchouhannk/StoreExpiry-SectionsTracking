const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = 3000;

// ── Swap this to an env var for production ──
const MONGO_URI =
  'mongodb+srv://otakuabhi2003_db_user:FIgLxm08PVDtpHdu@cluster0.6sdduhi.mongodb.net/?appName=Cluster0';
const DB_NAME = 'store_manager';

let db;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper ──────────────────────────────────────────────
function currentPeriod() {
  const n = new Date();
  return {
    year: n.getFullYear(),
    month: n.getMonth() + 1,
    week: Math.min(Math.ceil(n.getDate() / 7), 4),
  };
}

// ── Connect, seed defaults, start ──────────────────────
MongoClient.connect(MONGO_URI).then(async (client) => {
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB Atlas');

  // Seed 5 default sections on first run
  const count = await db.collection('sections').countDocuments();
  if (count === 0) {
    await db.collection('sections').insertMany([
      { name: 'Chocolate', slug: 'chocolate', icon: '🍫', location: 'Aisle 3', displayOrder: 1, createdAt: new Date() },
      { name: 'Novelty Candy', slug: 'novelty-candy', icon: '🍬', location: 'Aisle 4', displayOrder: 2, createdAt: new Date() },
      { name: 'Meat Snacks', slug: 'meat-snacks', icon: '🥩', location: 'Aisle 5', displayOrder: 3, createdAt: new Date() },
      { name: 'Candy Pegs', slug: 'candy-pegs', icon: '🍭', location: 'End Cap A', displayOrder: 4, createdAt: new Date() },
      { name: 'Chocolate Pegs', slug: 'chocolate-pegs', icon: '🍫', location: 'End Cap B', displayOrder: 5, createdAt: new Date() },
    ]);
    console.log('Seeded 5 default sections');
  }

  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}).catch((err) => { console.error(err); process.exit(1); });

// ═════════════════════════════════════════════════════════
//  SECTIONS
// ═════════════════════════════════════════════════════════
app.get('/api/sections', async (req, res) => {
  try {
    res.json(await db.collection('sections').find().sort({ displayOrder: 1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sections/:id', async (req, res) => {
  try {
    const doc = await db.collection('sections').findOne({ _id: new ObjectId(req.params.id) });
    doc ? res.json(doc) : res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sections', async (req, res) => {
  try {
    const { name, icon, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const n = await db.collection('sections').countDocuments();
    const doc = { name, slug, icon: icon || '📦', location: location || '', displayOrder: n + 1, createdAt: new Date() };
    const r = await db.collection('sections').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sections/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await db.collection('sections').deleteOne({ _id: new ObjectId(id) });
    await Promise.all(['cleaning_logs','planogram_checks','expiry_logs','order_items']
      .map((c) => db.collection(c).deleteMany({ sectionId: id })));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═════════════════════════════════════════════════════════
//  DASHBOARD  (one call for the whole page)
// ═════════════════════════════════════════════════════════
app.get('/api/dashboard', async (req, res) => {
  try {
    const p = currentPeriod();
    const sections = await db.collection('sections').find().sort({ displayOrder: 1 }).toArray();
    const summaries = await Promise.all(sections.map(async (s) => {
      const sid = s._id.toString();
      const expiryCount = await db.collection('expiry_logs').countDocuments({ sectionId: sid, removed: false });
      const orderCount  = await db.collection('order_items').countDocuments({ sectionId: sid, ordered: false });
      const cleaned     = await db.collection('cleaning_logs').findOne({ sectionId: sid, year: p.year, month: p.month, week: p.week });
      return { ...s, expiryCount, orderCount, cleanedThisWeek: !!cleaned };
    }));
    res.json({
      sections: summaries,
      summary: {
        expiryAlerts:  summaries.reduce((a, s) => a + s.expiryCount, 0),
        pendingOrders: summaries.reduce((a, s) => a + s.orderCount, 0),
        cleansThisWeek: summaries.filter((s) => s.cleanedThisWeek).length,
        totalSections: sections.length,
      },
      currentPeriod: p,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/expiry-details', async (req, res) => {
  try {
    const sections = await db.collection('sections').find().sort({ displayOrder: 1 }).toArray();
    const out = await Promise.all(sections.map(async (s) => {
      const items = await db.collection('expiry_logs').find({ sectionId: s._id.toString(), removed: false }).sort({ expiryDate: 1 }).toArray();
      return { section: s, items };
    }));
    res.json(out.filter((d) => d.items.length > 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/order-details', async (req, res) => {
  try {
    const sections = await db.collection('sections').find().sort({ displayOrder: 1 }).toArray();
    const out = await Promise.all(sections.map(async (s) => {
      const items = await db.collection('order_items').find({ sectionId: s._id.toString(), ordered: false }).sort({ date: -1 }).toArray();
      return { section: s, items };
    }));
    res.json(out.filter((d) => d.items.length > 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/cleaning-details', async (req, res) => {
  try {
    const p = currentPeriod();
    const sections = await db.collection('sections').find().sort({ displayOrder: 1 }).toArray();
    const out = await Promise.all(sections.map(async (s) => {
      const entry = await db.collection('cleaning_logs').findOne({ sectionId: s._id.toString(), year: p.year, month: p.month, week: p.week });
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
    res.json(await db.collection('cleaning_logs')
      .find({ sectionId, year: +year, month: +month }).sort({ week: 1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cleaning-logs', async (req, res) => {
  try {
    const { sectionId, year, month, week, dateCleaned, cleanedBy, comments } = req.body;
    const exists = await db.collection('cleaning_logs').findOne({ sectionId, year: +year, month: +month, week: +week });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this week' });
    const doc = { sectionId, year: +year, month: +month, week: +week, dateCleaned: new Date(dateCleaned), cleanedBy: cleanedBy || '', comments: comments || '', createdAt: new Date() };
    const r = await db.collection('cleaning_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cleaning-logs/:id', async (req, res) => {
  try {
    await db.collection('cleaning_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═════════════════════════════════════════════════════════
//  PLANOGRAM CHECKS
// ═════════════════════════════════════════════════════════
app.get('/api/planogram-checks', async (req, res) => {
  try {
    const { sectionId, year, month } = req.query;
    res.json(await db.collection('planogram_checks')
      .find({ sectionId, year: +year, month: +month }).sort({ week: 1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/planogram-checks', async (req, res) => {
  try {
    const { sectionId, year, month, week, dateChecked, checkedBy, comments, planogramFixed } = req.body;
    const exists = await db.collection('planogram_checks').findOne({ sectionId, year: +year, month: +month, week: +week });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this week' });
    const doc = { sectionId, year: +year, month: +month, week: +week, dateChecked: new Date(dateChecked), checkedBy: checkedBy || '', comments: comments || '', planogramFixed: !!planogramFixed, createdAt: new Date() };
    const r = await db.collection('planogram_checks').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/planogram-checks/:id', async (req, res) => {
  try {
    await db.collection('planogram_checks').deleteOne({ _id: new ObjectId(req.params.id) });
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
    res.json(await db.collection('expiry_logs').find(q).sort({ date: -1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/expiry-logs', async (req, res) => {
  try {
    const { sectionId, date, item, expiryDate, signOffBy, removed } = req.body;
    const doc = { sectionId, date: new Date(date), item: item || '', expiryDate: expiryDate ? new Date(expiryDate) : null, removed: !!removed, signOffBy: signOffBy || '', createdAt: new Date() };
    const r = await db.collection('expiry_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/expiry-logs/:id', async (req, res) => {
  try {
    const u = {};
    if (req.body.removed !== undefined) u.removed = req.body.removed;
    if (req.body.signOffBy !== undefined) u.signOffBy = req.body.signOffBy;
    await db.collection('expiry_logs').updateOne({ _id: new ObjectId(req.params.id) }, { $set: u });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/expiry-logs/:id', async (req, res) => {
  try {
    await db.collection('expiry_logs').deleteOne({ _id: new ObjectId(req.params.id) });
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
    res.json(await db.collection('order_items').find(q).sort({ date: -1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/order-items', async (req, res) => {
  try {
    const { sectionId, date, item, comments } = req.body;
    const doc = { sectionId, date: new Date(date), item: item || '', comments: comments || '', ordered: false, createdAt: new Date() };
    const r = await db.collection('order_items').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/order-items/:id', async (req, res) => {
  try {
    const u = {};
    if (req.body.ordered !== undefined) u.ordered = req.body.ordered;
    await db.collection('order_items').updateOne({ _id: new ObjectId(req.params.id) }, { $set: u });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/order-items/:id', async (req, res) => {
  try {
    await db.collection('order_items').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Fallback ────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));