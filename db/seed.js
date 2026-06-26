async function seedIfNeeded(db) {
  const collections = ['sections', 'cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items'];
  for (const col of collections) {
    await db.collection(col).updateMany(
      { siteId: { $exists: false } },
      { $set: { siteId: 'C01158' } }
    );
  }
  const count = await db.collection('sections').countDocuments({ siteId: 'C01158' });
  if (count === 0) {
    await db.collection('sections').insertMany([
      { name: 'Chocolate', slug: 'chocolate', icon: '🍫', location: 'Aisle 3', displayOrder: 1, siteId: 'C01158', createdAt: new Date() },
      { name: 'Novelty Candy', slug: 'novelty-candy', icon: '🍬', location: 'Aisle 4', displayOrder: 2, siteId: 'C01158', createdAt: new Date() },
      { name: 'Meat Snacks', slug: 'meat-snacks', icon: '🥩', location: 'Aisle 5', displayOrder: 3, siteId: 'C01158', createdAt: new Date() },
      { name: 'Candy Pegs', slug: 'candy-pegs', icon: '🍭', location: 'End Cap A', displayOrder: 4, siteId: 'C01158', createdAt: new Date() },
      { name: 'Chocolate Pegs', slug: 'chocolate-pegs', icon: '🍫', location: 'End Cap B', displayOrder: 5, siteId: 'C01158', createdAt: new Date() },
    ]);
  }
}
module.exports = { seedIfNeeded };