const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
/* ── Multer: in-memory only (Vercel-safe), PDF only, 15 MB cap ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});
// wrapper so multer errors return JSON instead of crashing
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',   // PDFs are classified as "image" by Cloudinary
        folder: 'planograms',
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}
/* ────────── existing routes ────────── */
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
/* ────────── NEW: upload / replace planogram ────────── */
router.post('/:id/planogram', handleUpload, async (req, res) => {
  try {
    const id = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const section = await req.db.collection('sections').findOne({ _id: new ObjectId(id) });
    if (!section) return res.status(404).json({ error: 'Section not found' });
    // delete old file from Cloudinary first (replace semantics)
    if (section.planogram?.publicId) {
      try {
        await cloudinary.uploader.destroy(section.planogram.publicId, {
          resource_type: section.planogram.resourceType || 'image',
        });
      } catch (_) { /* non-fatal: continue with new upload */ }
    }
    const result = await uploadToCloudinary(req.file.buffer);
    const planogram = {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      fileName: req.file.originalname,
      uploadedAt: new Date(),
    };
    await req.db.collection('sections').updateOne(
      { _id: new ObjectId(id) },
      { $set: { planogram } }
    );
    res.json(planogram);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
/* ────────── delete (also clean up Cloudinary) ────────── */
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const section = await req.db.collection('sections').findOne({ _id: new ObjectId(id) });
    if (section?.planogram?.publicId) {
      try {
        await cloudinary.uploader.destroy(section.planogram.publicId, {
          resource_type: section.planogram.resourceType || 'image',
        });
      } catch (_) {}
    }
    await req.db.collection('sections').deleteOne({ _id: new ObjectId(id) });
    await Promise.all(['cleaning_logs', 'planogram_checks', 'expiry_logs', 'order_items']
      .map((c) => req.db.collection(c).deleteMany({ sectionId: id })));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;