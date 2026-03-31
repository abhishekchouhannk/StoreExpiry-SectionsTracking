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
    if (req.query.type) q.type = req.query.type;
    res.json(await req.db.collection('checklist_logs').find(q).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checklist', async (req, res) => {
  try {
    const { siteId, date, task, shift, initials } = req.body;
    if (!siteId || !date || !task || !shift || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    // Prevent duplicates (also filter by type if provided)
    const dupQuery = { siteId, date, task, shift };
    if (req.body.type) dupQuery.type = req.body.type;
    const exists = await req.db.collection('checklist_logs').findOne(dupQuery);
    if (exists) return res.status(400).json({ error: 'Entry already exists for this cell' });
    const doc = { siteId, date, task, shift, initials: initials.toUpperCase(), createdAt: new Date() };
    const r   = await req.db.collection('checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
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


// ═════════════════════════════════════════════════════════
//  DAILY CHECKLIST (separate collection from shift checklist)
// ═════════════════════════════════════════════════════════
app.get('/api/daily-checklist', async (req, res) => {
  try {
    const { siteId, from, to } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    res.json(await req.db.collection('daily_checklist_logs')
      .find({ siteId, date: { $gte: from, $lte: to } }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/daily-checklist', async (req, res) => {
  try {
    const { siteId, date, task, initials } = req.body;
    if (!siteId || !date || !task || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    const exists = await req.db.collection('daily_checklist_logs').findOne({ siteId, date, task });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this cell' });
    const doc = { siteId, date, task, initials: initials.toUpperCase(), createdAt: new Date() };
    const r   = await req.db.collection('daily_checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/daily-checklist/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('daily_checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/daily-checklist/:id', async (req, res) => {
  try {
    await req.db.collection('daily_checklist_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ═════════════════════════════════════════════════════════
//  WEEKLY CHECKLIST
// ═════════════════════════════════════════════════════════
app.get('/api/weekly-checklist', async (req, res) => {
  try {
    const { siteId, weekStart } = req.query;
    if (!siteId || !weekStart) return res.status(400).json({ error: 'siteId and weekStart required' });
    res.json(await req.db.collection('weekly_checklist_logs').find({ siteId, weekStart }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/weekly-checklist', async (req, res) => {
  try {
    const { siteId, weekStart, task, initials } = req.body;
    if (!siteId || !weekStart || !task || !initials)
      return res.status(400).json({ error: 'Missing required fields' });
    const exists = await req.db.collection('weekly_checklist_logs').findOne({ siteId, weekStart, task });
    if (exists) return res.status(400).json({ error: 'Entry already exists for this task this week' });
    const doc = { siteId, weekStart, task, initials: initials.toUpperCase(), createdAt: new Date() };
    const r   = await req.db.collection('weekly_checklist_logs').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/weekly-checklist/:id', async (req, res) => {
  try {
    const { initials } = req.body;
    await req.db.collection('weekly_checklist_logs').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { initials: initials.toUpperCase() } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/weekly-checklist/:id', async (req, res) => {
  try {
    await req.db.collection('weekly_checklist_logs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ═════════════════════════════════════════════════════════
//  SCHEDULE — Claude Vision parsing + storage
// ═════════════════════════════════════════════════════════

// Parse schedule image with Claude Vision
app.post('/api/schedule/parse', async (req, res) => {
  try {
    const { image, mimeType, siteId } = req.body;
    if (!image || !mimeType || !siteId)
      return res.status(400).json({ error: 'image, mimeType and siteId required' });

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: image }
            },
            {
              type: 'text',
              text: `You are reading a weekly work schedule image. Extract the schedule and return ONLY a valid JSON object with no markdown, no explanation, no backticks.

The JSON must have this exact structure:
{
  "weekStart": "YYYY-MM-DD",
  "schedule": [
    {
      "name": "First name only",
      "shifts": [
        { "day": "Mon", "date": "YYYY-MM-DD", "start": "6:00", "end": "15:00", "hours": 9 },
        { "day": "Tue", "date": "YYYY-MM-DD", "start": null, "end": null, "hours": 0 }
      ]
    }
  ]
}

Rules:
- weekStart must be the Monday of the week shown (YYYY-MM-DD format)
- Include all 7 days (Mon-Sun) for each person
- For days marked "off", "na", "n/a" or blank: start=null, end=null, hours=0
- Convert times to 24h format: "6a" = "6:00", "3p" = "15:00", "10p" = "22:00", "2.30p" = "14:30"
- Use first name only for "name"
- If a cell has a non-numeric entry like "OW" or "96_s", treat as hours=0
- Return ONLY the JSON, nothing else`
            }
          ]
        }]
      })
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) throw new Error(data.error?.message || 'Claude API error');

    const text = data.content[0].text.trim();
    const parsed = JSON.parse(text);

    res.json({ weekStart: parsed.weekStart, schedule: parsed.schedule });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Save parsed schedule
app.post('/api/schedule', async (req, res) => {
  try {
    const { siteId, schedule } = req.body;
    if (!siteId || !schedule) return res.status(400).json({ error: 'Missing fields' });

    // Derive weekStart from schedule data (Monday of the first shift date)
    const firstDate = schedule[0]?.shifts?.find(s => s.hours > 0)?.date;
    if (!firstDate) return res.status(400).json({ error: 'No valid shift dates found' });

    const d = new Date(firstDate + 'T12:00:00');
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const weekStart = d.toISOString().split('T')[0];

    // Upsert — replace existing schedule for this site+week
    await req.db.collection('schedules').deleteOne({ siteId, weekStart });
    const doc = { siteId, weekStart, schedule, createdAt: new Date() };
    const r   = await req.db.collection('schedules').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get schedules for a site (newest first)
app.get('/api/schedule', async (req, res) => {
  try {
    const { siteId, weekStart } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const q = { siteId };
    if (weekStart) q.weekStart = weekStart;
    const docs = await req.db.collection('schedules').find(q).sort({ weekStart: -1 }).toArray();
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a schedule
app.delete('/api/schedule/:id', async (req, res) => {
  try {
    await req.db.collection('schedules').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ═════════════════════════════════════════════════════════
//  SCHEDULE — AI parse + store
// ═════════════════════════════════════════════════════════
const Anthropic = require('@anthropic-ai/sdk');

app.post('/api/schedule/parse', async (req, res) => {
  try {
    const { siteId, imageBase64, mediaType } = req.body;
    if (!siteId || !imageBase64) return res.status(400).json({ error: 'Missing fields' });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 }
          },
          {
            type: 'text',
            text: `Extract the weekly employee schedule from this image.
Return ONLY valid JSON in this exact format, nothing else:
{
  "weekOf": "YYYY-MM-DD",
  "schedule": [
    {
      "name": "First name only",
      "shifts": ["shift or off or na", "shift or off or na", "shift or off or na", "shift or off or na", "shift or off or na", "shift or off or na", "shift or off or na"]
    }
  ]
}
The shifts array must have exactly 7 values, one for each day of the week starting Sunday.
Use "off" when someone is off, "na" when not applicable or empty.
For shifts, use the format shown in the schedule (e.g. "6a-3p", "2.30p-10p", "10p-6a").
weekOf should be the Sunday (first day) of the week shown.
First name only for the name field. Do not include rows that are not staff (e.g. "Total Hours", "Cleaning/CW").
Return only the JSON object, no markdown, no explanation.`
          }
        ]
      }]
    });

    const raw = message.content[0].text.trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      // Try extracting JSON from response if there's extra text
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return res.status(500).json({ error: 'AI returned invalid JSON. Try a clearer image.' });
      parsed = JSON.parse(match[0]);
    }

    // Save to DB — replace any existing schedule for this site+week
    await req.db.collection('schedules').deleteMany({ siteId, weekOf: parsed.weekOf });
    await req.db.collection('schedules').insertOne({
      siteId,
      weekOf: parsed.weekOf,
      schedule: parsed.schedule,
      createdAt: new Date()
    });

    res.json({
      weekOf: parsed.weekOf,
      staffCount: parsed.schedule.length,
      schedule: parsed.schedule
    });
  } catch(e) {
    console.error('Schedule parse error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get current week's schedule for a site
app.get('/api/schedule/current', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });

    // Find the most recent schedule for this site
    const doc = await req.db.collection('schedules')
      .find({ siteId })
      .sort({ weekOf: -1 })
      .limit(1)
      .toArray();

    if (!doc.length) return res.json({ found: false });
    res.json({ found: true, weekOf: doc[0].weekOf, schedule: doc[0].schedule });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Fallback (SPA) ──────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Local dev server (not used by Vercel) ──────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}

module.exports = app;