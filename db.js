const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = process.env.DB_NAME || 'store_manager';
// ── Cached connection ───────────────────────────────────
// Vercel serverless functions are short-lived. Cache the client
// on the module scope so warm invocations reuse the same connection.
let cachedClient = null;
let cachedDb     = null;
async function getDb() {
  if (cachedDb) return cachedDb;
  const client = await MongoClient.connect(MONGO_URI);
  cachedClient = client;
  cachedDb     = client.db(DB_NAME);
  return cachedDb;
}
// ── One-time seed / migration (runs on first cold start) ─
async function seedIfNeeded(db) {
  // Backfill any docs missing siteId → C01158
  const collections = [
    'sections', 'cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items',
  ];
  for (const col of collections) {
    await db.collection(col).updateMany(
      { siteId: { $exists: false } },
      { $set: { siteId: 'C01158' } },
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
module.exports = { getDb, seedIfNeeded };