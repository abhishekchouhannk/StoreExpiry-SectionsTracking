const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Files are handled in memory (buffer) — nothing touches Vercel's filesystem
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB cap — see note at bottom re: Vercel body limits
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});
function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',   // Cloudinary serves PDFs via its "image" delivery pipeline
        public_id: publicId,      // fixed id per section → re-uploads overwrite the old file
        folder: 'planograms',
        overwrite: true,
        invalidate: true,         // bust any CDN cache of the old file at this public_id
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}
router.get('/', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    res.json(await req.db.collection('sections').find({ siteId }).sort({ displayOrder: 1 }).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', async (req, res) => {
  try {
    const doc = await req.db.collection('sections').findOne({ _id: new ObjectId(req.params.id) });
    doc ? res.json(doc) : res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const { name, icon, location, siteId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const n = await req.db.collection('sections').countDocuments({ siteId });
    const doc = { name, slug, icon: icon || '📦', location: location || '', displayOrder: n + 1, siteId, createdAt: new Date() };
    const r = await req.db.collection('sections').insertOne(doc);
    res.json({ ...doc, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── Upload / replace the planogram PDF for a section ──
router.post('/:id/planogram', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const sectionId = req.params.id;
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const section = await req.db.collection('sections').findOne({ _id: new ObjectId(sectionId) });
      if (!section) return res.status(404).json({ error: 'Section not found' });
      const result = await uploadToCloudinary(req.file.buffer, `planogram_${sectionId}`);
      const update = {
        planogramUrl: result.secure_url,
        planogramPublicId: result.public_id,
        planogramFileName: req.file.originalname,
        planogramUpdatedAt: new Date(),
      };
      await req.db.collection('sections').updateOne(
        { _id: new ObjectId(sectionId) },
        { $set: update }
      );
      res.json({ success: true, ...update });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});
// ── Remove a section's planogram (optional, nice to have) ──
router.delete('/:id/planogram', async (req, res) => {
  try {
    const sectionId = req.params.id;
    const section = await req.db.collection('sections').findOne({ _id: new ObjectId(sectionId) });
    if (!section) return res.status(404).json({ error: 'Section not found' });
    if (section.planogramPublicId) {
      await cloudinary.uploader.destroy(section.planogramPublicId, { resource_type: 'image' });
    }
    await req.db.collection('sections').updateOne(
      { _id: new ObjectId(sectionId) },
      { $unset: { planogramUrl: '', planogramPublicId: '', planogramFileName: '', planogramUpdatedAt: '' } }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const section = await req.db.collection('sections').findOne({ _id: new ObjectId(id) });
    if (section?.planogramPublicId) {
      await cloudinary.uploader.destroy(section.planogramPublicId, { resource_type: 'image' }).catch(() => {});
    }
    await req.db.collection('sections').deleteOne({ _id: new ObjectId(id) });
    await Promise.all(['cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items']
      .map((c) => req.db.collection(c).deleteMany({ sectionId: id })));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;