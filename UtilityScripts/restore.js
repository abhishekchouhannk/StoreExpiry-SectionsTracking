// restore.js — run with: node UtilityScripts/restore.js
// Destructively overwrites the database with a chosen backup JSON file.
//
// Usage:
//   node UtilityScripts/restore.js                          ← lists available backups, picks latest
//   node UtilityScripts/restore.js backup-2026-03-31.json   ← restore specific file

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');
const fs   = require('fs');
const path = require('path');
const readline = require('readline');

const MONGO_URI   = process.env.MONGO_URI;
const DB_NAME     = process.env.DB_NAME || 'store_manager';
const BACKUP_DIR  = path.join(__dirname, 'backups');
const COLLECTIONS = ['sections', 'cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items', 'checklist_logs'];

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

async function restore() {
  // ── Pick backup file ──────────────────────────────────
  let filename = process.argv[2];

  if (!filename) {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort().reverse(); // newest first

    if (files.length === 0) {
      console.error('❌ No backup files found in UtilityScripts/backups/');
      process.exit(1);
    }

    console.log('\nAvailable backups:\n');
    files.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));
    console.log();

    const choice = await ask(`Pick a backup (1-${files.length}), or press Enter for latest [1]: `);
    const idx = choice === '' ? 0 : parseInt(choice) - 1;

    if (isNaN(idx) || idx < 0 || idx >= files.length) {
      console.error('❌ Invalid choice.');
      process.exit(1);
    }
    filename = files[idx];
  }

  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    process.exit(1);
  }

  // ── Confirm ───────────────────────────────────────────
  console.log(`\n⚠️  You are about to COMPLETELY OVERWRITE the database with:`);
  console.log(`   ${filename}\n`);
  console.log(`   This will DELETE all current data and cannot be undone.\n`);

  const confirm = await ask('Type YES to continue: ');
  if (confirm !== 'YES') {
    console.log('\nAborted. Nothing was changed.');
    process.exit(0);
  }

  // ── Load backup ───────────────────────────────────────
  const snapshot = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  // ── Restore ───────────────────────────────────────────
  const client = await MongoClient.connect(MONGO_URI);
  const db     = client.db(DB_NAME);

  console.log('\nRestoring...\n');
  for (const col of COLLECTIONS) {
    const docs = snapshot[col] || [];
    await db.collection(col).deleteMany({});
    if (docs.length > 0) await db.collection(col).insertMany(docs);
    console.log(`  ✓ ${col}: restored ${docs.length} documents`);
  }

  await client.close();
  console.log(`\n✅ Database restored from ${filename}`);
}

restore().catch((err) => {
  console.error('❌ Restore failed:', err.message);
  process.exit(1);
});