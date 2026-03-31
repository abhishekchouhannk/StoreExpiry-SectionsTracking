// backup.js — run with: node backup.js
// Saves a timestamped JSON snapshot of the entire database to ./backups/

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');
const fs   = require('fs');
const path = require('path');

const MONGO_URI   = process.env.MONGO_URI;
const DB_NAME     = process.env.DB_NAME || 'store_manager';
const BACKUP_DIR  = path.join(__dirname, 'backups');
const COLLECTIONS = ['sections', 'cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items', 'checklist_logs'];

async function backup() {
  const client = await MongoClient.connect(MONGO_URI);
  const db     = client.db(DB_NAME);

  const snapshot = {};
  for (const col of COLLECTIONS) {
    snapshot[col] = await db.collection(col).find().toArray();
    console.log(`  ✓ ${col}: ${snapshot[col].length} documents`);
  }

  await client.close();

  // Create backups folder if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

  // Filename: backup-2026-03-31T11-34-00.json
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename  = `backup-${timestamp}.json`;
  const filepath  = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  console.log(`\n✅ Backup saved → backups/${filename}`);
}

backup().catch((err) => {
  console.error('❌ Backup failed:', err.message);
  process.exit(1);
});