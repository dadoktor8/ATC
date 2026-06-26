const router = require('express').Router();
const db = require('../db/schema');
const { adminOnly } = require('../middleware/auth');
const { generateAdmitCard } = require('../generators/admitCard');
const { generateAllocationSheet } = require('../generators/allocationSheet');
const { generateAllocationSheetPdf } = require('../generators/allocationSheetPdf');
const { generateResultSheet } = require('../generators/resultSheet');
const { generateMarksheet } = require('../generators/marksheet');
const { generateMarkSheetPdf } = require('../generators/markSheetPdf');
const { generateCertificate, generateCertificateBulk, IMAGES_DIR, IMAGE_FILES } = require('../generators/certificate');
const fs = require('fs');
const path = require('path');

function getStudents(filters) {
  let q = `
    SELECT s.*, c.name as center_name, c.district, c.incharge_name,
           m.practical_paper1, m.practical_paper2, m.practical_fabric,
           m.ia_composition, m.ia_illustration, m.ia_still_life,
           m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
           m.ia_lettering, m.ia_sketch, m.ia_poster_design,
           m.ia_total, m.oral, m.theory_paper1, m.theory_paper2,
           m.total_marks, m.division, m.distinction, m.certificate_no
    FROM students s
    LEFT JOIN centers c ON s.center_id = c.id
    LEFT JOIN marks m ON m.student_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (filters.center_id) { q += ' AND s.center_id=?'; params.push(filters.center_id); }
  if (filters.year)      { q += ' AND s.year=?';      params.push(filters.year); }
  if (filters.batch_id)  { q += ' AND s.batch_id=?';  params.push(filters.batch_id); }
  if (filters.session)   { q += ' AND s.session=?';   params.push(filters.session); }
  q += ' ORDER BY CAST(s.roll_no AS INTEGER)';
  return db.prepare(q).all(...params);
}

router.get('/admit-card/:studentId', async (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.*, c.name as center_name, c.district, c.incharge_name
      FROM students s LEFT JOIN centers c ON s.center_id=c.id
      WHERE s.id=?
    `).get(req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const buf = await generateAdmitCard(student);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="admit-card-${student.roll_no}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/admit-cards', async (req, res, next) => {
  try {
    const students = getStudents(req.query);
    const buf = await generateAdmitCard(students, true);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="admit-cards-bulk.docx"');
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/allocation-sheet-pdf?batch_id=
// Generates image-overlay PDF sorted by year class order, 25 per page
router.get('/allocation-sheet-pdf', async (req, res, next) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });

    const students = getStudents({ batch_id });
    if (!students.length) return res.status(404).json({ error: 'No students in this batch' });

    const batch  = db.prepare('SELECT * FROM batches WHERE id=?').get(batch_id);
    const center = batch
      ? db.prepare('SELECT * FROM centers WHERE id=?').get(batch.center_id)
      : null;
    const session = batch?.session || students[0]?.session || '';

    const buf = await generateAllocationSheetPdf(students, center, session);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="allocation-sheet-batch${batch_id}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// PDF alias — same as allocation-sheet but accepts batch_id; returns the DOCX blob
router.get('/allocation-sheet-pdf', async (req, res, next) => {
  try {
    const students = getStudents(req.query);
    if (!students.length) return res.status(404).json({ error: 'No students found in this batch' });
    const center = req.query.center_id
      ? db.prepare('SELECT * FROM centers WHERE id=?').get(req.query.center_id)
      : students[0]?.center_id
        ? db.prepare('SELECT * FROM centers WHERE id=?').get(students[0].center_id)
        : db.prepare('SELECT * FROM centers LIMIT 1').get();
    const buf = await generateAllocationSheet(students, center);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="allocation-sheet.docx"');
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/allocation-sheet', async (req, res, next) => {
  try {
    const students = getStudents(req.query);
    const center = req.query.center_id
      ? db.prepare('SELECT * FROM centers WHERE id=?').get(req.query.center_id)
      : db.prepare('SELECT * FROM centers LIMIT 1').get();
    const buf = await generateAllocationSheet(students, center);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="allocation-sheet.docx"');
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/result-sheet', async (req, res, next) => {
  try {
    const students = getStudents(req.query);
    const center = req.query.center_id
      ? db.prepare('SELECT * FROM centers WHERE id=?').get(req.query.center_id)
      : db.prepare('SELECT * FROM centers LIMIT 1').get();
    const buf = await generateResultSheet(students, center);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="result-sheet.docx"');
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/result-sheet-pdf?batch_id=
// Same template/coords as allocation sheet — just a result-labelled download
router.get('/result-sheet-pdf', async (req, res, next) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });

    const students = getStudents({ batch_id });
    if (!students.length) return res.status(404).json({ error: 'No students in this batch' });

    const batch   = db.prepare('SELECT * FROM batches WHERE id=?').get(batch_id);
    const center  = batch ? db.prepare('SELECT * FROM centers WHERE id=?').get(batch.center_id) : null;
    const session = batch?.session || students[0]?.session || '';

    const buf = await generateAllocationSheetPdf(students, center, session, {
      imageName: 'result_sheet',
      coordsFile: 'result_sheet_coords.json',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="result-sheet-batch${batch_id}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/mark-sheet-pdf/:studentId → single student, validates marks exist
router.get('/mark-sheet-pdf/:studentId', async (req, res, next) => {
  try {
    const student = db.prepare(`
      SELECT s.*, c.name as center_name, c.incharge_name,
             m.practical_paper1, m.practical_paper2, m.practical_fabric,
             m.ia_composition, m.ia_illustration, m.ia_still_life,
             m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
             m.ia_lettering, m.ia_sketch, m.ia_poster_design,
             m.ia_total, m.oral, m.theory_paper1, m.theory_paper2,
             m.total_marks, m.division, m.distinction, m.certificate_no
      FROM students s
      LEFT JOIN centers c ON s.center_id = c.id
      LEFT JOIN marks m ON m.student_id = s.id
      WHERE s.id=?
    `).get(req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.total_marks == null)
      return res.status(422).json({ error: 'Marks not entered for this student', roll_no: student.roll_no });

    const center = student.center_id
      ? db.prepare('SELECT * FROM centers WHERE id=?').get(student.center_id)
      : null;

    const buf = await generateMarkSheetPdf(student, center, student.session || '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="mark-sheet-${student.roll_no}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/mark-sheet-pdf?batch_id=   → bulk PDF, students with marks only
router.get('/mark-sheet-pdf', async (req, res, next) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });

    const all = getStudents({ batch_id });
    if (!all.length) return res.status(404).json({ error: 'No students in this batch' });

    const missing = all.filter(s => s.total_marks == null).map(s => s.roll_no);
    if (missing.length === all.length)
      return res.status(422).json({ error: 'No students have marks entered yet', missing });

    const students = all.filter(s => s.total_marks != null);
    const batch    = db.prepare('SELECT * FROM batches WHERE id=?').get(batch_id);
    const center   = batch ? db.prepare('SELECT * FROM centers WHERE id=?').get(batch.center_id) : null;
    const session  = batch?.session || students[0]?.session || '';

    const buf = await generateMarkSheetPdf(students, center, session);
    res.setHeader('Content-Type', 'application/pdf');
    // Tell the frontend how many were skipped so it can show a warning
    if (missing.length) res.setHeader('X-Skipped-Students', missing.join(','));
    res.setHeader('Content-Disposition', `attachment; filename="mark-sheets-batch${batch_id}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/marksheet/:studentId', async (req, res, next) => {
  try {
    const student = db.prepare(`
      SELECT s.*, c.name as center_name, c.district, c.incharge_name,
             m.*
      FROM students s
      LEFT JOIN centers c ON s.center_id=c.id
      LEFT JOIN marks m ON m.student_id=s.id
      WHERE s.id=?
    `).get(req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const buf = await generateMarksheet(student);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="marksheet-${student.roll_no}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// ── Admit card PDF (image-overlay) ──────────────────────────────
// GET /api/generate/admit-card-pdf/:studentId
router.get('/admit-card-pdf/:studentId', async (req, res, next) => {
  try {
    const student = db.prepare(`
      SELECT s.*, c.name as center_name, c.district, c.incharge_name
      FROM students s LEFT JOIN centers c ON s.center_id=c.id
      WHERE s.id=?
    `).get(req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const buf = await generateCertificate(student, 'admit_card');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="admit-card-${student.roll_no}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/admit-cards-pdf?center_id=&year=
router.get('/admit-cards-pdf', async (req, res, next) => {
  try {
    const students = getStudents(req.query);
    if (!students.length) return res.status(404).json({ error: 'No students found' });

    const buf = await generateCertificateBulk(students, 'admit_card');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="admit-cards.pdf"');
    res.send(buf);
  } catch (e) { next(e); }
});

// ── Certificate generation ──────────────────────────────────────

// GET /api/generate/certificate/:studentId?cert_type=senior_diploma_final
router.get('/certificate/:studentId', async (req, res, next) => {
  try {
    const certType = req.query.cert_type || 'senior_diploma_final';
    const student = db.prepare(`
      SELECT s.*, c.name as center_name, c.district, c.incharge_name,
             m.division, m.distinction, m.certificate_no, m.total_marks
      FROM students s
      LEFT JOIN centers c ON s.center_id=c.id
      LEFT JOIN marks m ON m.student_id=s.id
      WHERE s.id=?
    `).get(req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const buf = await generateCertificate(student, certType);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="cert-${student.roll_no}-${certType}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/certificates?cert_type=senior_diploma_final&center_id=1&year=...
router.get('/certificates', async (req, res, next) => {
  try {
    const certType = req.query.cert_type || 'senior_diploma_final';
    const students = getStudents(req.query);
    if (!students.length) return res.status(404).json({ error: 'No students found' });

    const buf = await generateCertificateBulk(students, certType);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="certificates-${certType}-bulk.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/certificates-zip?cert_type=...&center_id=&year=
// Returns a ZIP file containing one PDF per student
router.get('/certificates-zip', async (req, res, next) => {
  try {
    const JSZip = require('jszip');
    const certType = req.query.cert_type || 'senior_diploma_final';
    const students = getStudents(req.query);
    if (!students.length) return res.status(404).json({ error: 'No students found' });

    const zip = new JSZip();
    for (const student of students) {
      const buf = await generateCertificate(student, certType);
      zip.file(`${student.roll_no}-${certType}.pdf`, buf);
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="certificates-${certType}.zip"`);
    res.send(zipBuf);
  } catch (e) { next(e); }
});

// POST /api/generate/upload-template  — upload a certificate PNG/JPEG
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
    cb(null, IMAGES_DIR);
  },
  filename: (req, file, cb) => {
    const certType = req.body.cert_type || 'unknown';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${certType}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/upload-template', adminOnly, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    success: true,
    message: `Template saved: ${req.file.filename}`,
    path: req.file.path
  });
});

// GET /api/generate/template-status — check which templates have images
router.get('/template-status', (req, res) => {
  const status = {};
  Object.entries(IMAGE_FILES).forEach(([certType, candidates]) => {
    status[certType] = candidates.some(f =>
      fs.existsSync(path.join(IMAGES_DIR, f))
    );
  });
  res.json(status);
});

module.exports = router;
