const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'store_manager';
let cachedClient = null;
let cachedDb = null;
async function getDb() {
  if (cachedDb) return cachedDb;
  const client = await MongoClient.connect(MONGO_URI);
  cachedClient = client;
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}
module.exports = { getDb };