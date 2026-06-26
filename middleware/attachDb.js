const { getDb } = require('../config/db');
const { seedIfNeeded } = require('../db/seed');
let seeded = false;
module.exports = async function attachDb(req, res, next) {
  try {
    const db = await getDb();
    if (!seeded) {
      await seedIfNeeded(db);
      seeded = true;
    }
    req.db = db;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Database connection failed: ' + e.message });
  }
};