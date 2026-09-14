const router = require('express').Router();
const db = require('../db/client');
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

const VALID_CERT_TYPES = new Set([
  'admit_card', 'allocation_sheet', 'result_sheet', 'mark_sheet',
  'senior_diploma_final', 'junior_diploma', 'ankan_visharad',
  'junior_diploma_final', 'ankan_ratna',
]);

async function getStudents(filters) {
  let q = `
    SELECT s.*, c.name as center_name, c.district, c.incharge_name, c.address as center_address, c.state as center_state,
           m.practical_paper1, m.practical_paper2, m.practical_fabric,
           m.ia_composition, m.ia_illustration, m.ia_still_life,
           m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
           m.ia_lettering, m.ia_sketch, m.ia_poster_design,
           m.ia_total, m.oral, m.theory_paper1, m.theory_paper2,
           m.total_marks, m.division, m.distinction, m.certificate_no, m.marksheet_date
    FROM students s
    LEFT JOIN centers c ON s.center_id = c.id
    LEFT JOIN marks m ON m.student_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (filters.center_id) { q += ` AND s.center_id=$${params.length + 1}`; params.push(filters.center_id); }
  if (filters.year)      { q += ` AND s.year=$${params.length + 1}`;      params.push(filters.year); }
  if (filters.batch_id)  { q += ` AND s.batch_id=$${params.length + 1}`;  params.push(filters.batch_id); }
  if (filters.session)   { q += ` AND s.session=$${params.length + 1}`;   params.push(filters.session); }
  q += ' ORDER BY CAST(s.roll_no AS INTEGER)';
  return await db.all(q, params);
}

router.get('/admit-card/:studentId', async (req, res, next) => {
  try {
    const student = await db.get(`
      SELECT s.*, c.name as center_name, c.district, c.incharge_name
      FROM students s LEFT JOIN centers c ON s.center_id=c.id
      WHERE s.id=$1
    `, [req.params.studentId]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const buf = await generateAdmitCard(student);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="admit-card-${student.roll_no}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/admit-cards', async (req, res, next) => {
  try {
    const students = await getStudents(req.query);
    const buf = await generateAdmitCard(students, true);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="admit-cards-bulk.docx"');
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/allocation-sheet-pdf?batch_id=
router.get('/allocation-sheet-pdf', async (req, res, next) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });

    const students = await getStudents({ batch_id });
    if (!students.length) return res.status(404).json({ error: 'No students in this batch' });

    const batch  = await db.get('SELECT * FROM batches WHERE id=$1', [batch_id]);
    const center = batch ? await db.get('SELECT * FROM centers WHERE id=$1', [batch.center_id]) : null;
    const session = batch?.session || students[0]?.session || '';

    const buf = await generateAllocationSheetPdf(students, center, session, { noBg: req.query.no_bg === '1' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="allocation-sheet-batch${batch_id}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/allocation-sheet', async (req, res, next) => {
  try {
    const students = await getStudents(req.query);
    const center = req.query.center_id
      ? await db.get('SELECT * FROM centers WHERE id=$1', [req.query.center_id])
      : await db.get('SELECT * FROM centers LIMIT 1');
    const buf = await generateAllocationSheet(students, center);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="allocation-sheet.docx"');
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/result-sheet', async (req, res, next) => {
  try {
    const students = await getStudents(req.query);
    const center = req.query.center_id
      ? await db.get('SELECT * FROM centers WHERE id=$1', [req.query.center_id])
      : await db.get('SELECT * FROM centers LIMIT 1');
    const buf = await generateResultSheet(students, center);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="result-sheet.docx"');
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/result-sheet-pdf?batch_id=
router.get('/result-sheet-pdf', async (req, res, next) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });

    const students = await getStudents({ batch_id });
    if (!students.length) return res.status(404).json({ error: 'No students in this batch' });

    const batch   = await db.get('SELECT * FROM batches WHERE id=$1', [batch_id]);
    const center  = batch ? await db.get('SELECT * FROM centers WHERE id=$1', [batch.center_id]) : null;
    const session = batch?.session || students[0]?.session || '';

    const buf = await generateAllocationSheetPdf(students, center, session, {
      imageName: 'result_sheet',
      coordsFile: 'result_sheet_coords.json',
      showMarks: true,
      noBg: req.query.no_bg === '1',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="result-sheet-batch${batch_id}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/mark-sheet-pdf/:studentId
router.get('/mark-sheet-pdf/:studentId', async (req, res, next) => {
  try {
    const student = await db.get(`
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
      WHERE s.id=$1
    `, [req.params.studentId]);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.total_marks == null)
      return res.status(422).json({ error: 'Marks not entered for this student', roll_no: student.roll_no });

    const center = student.center_id
      ? await db.get('SELECT * FROM centers WHERE id=$1', [student.center_id])
      : null;

    const buf = await generateMarkSheetPdf(student, center, student.session || '', { noBg: req.query.no_bg === '1' });
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
    await db.run('UPDATE marks SET marksheet_date=$1 WHERE student_id=$2', [dateStr, student.id]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="mark-sheet-${student.roll_no}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/mark-sheet-pdf?batch_id=
router.get('/mark-sheet-pdf', async (req, res, next) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });

    const all = await getStudents({ batch_id });
    if (!all.length) return res.status(404).json({ error: 'No students in this batch' });

    const missing = all.filter(s => s.total_marks == null).map(s => s.roll_no);
    if (missing.length === all.length)
      return res.status(422).json({ error: 'No students have marks entered yet', missing });

    const students = all.filter(s => s.total_marks != null);
    const batch    = await db.get('SELECT * FROM batches WHERE id=$1', [batch_id]);
    const center   = batch ? await db.get('SELECT * FROM centers WHERE id=$1', [batch.center_id]) : null;
    const session  = batch?.session || students[0]?.session || '';

    const buf = await generateMarkSheetPdf(students, center, session, { noBg: req.query.no_bg === '1' });
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
    for (const s of students) {
      await db.run('UPDATE marks SET marksheet_date=$1 WHERE student_id=$2', [dateStr, s.id]);
    }
    res.setHeader('Content-Type', 'application/pdf');
    if (missing.length) res.setHeader('X-Skipped-Students', missing.join(','));
    res.setHeader('Content-Disposition', `attachment; filename="mark-sheets-batch${batch_id}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/marksheet/:studentId', async (req, res, next) => {
  try {
    const student = await db.get(`
      SELECT s.*, c.name as center_name, c.district, c.incharge_name,
             m.*
      FROM students s
      LEFT JOIN centers c ON s.center_id=c.id
      LEFT JOIN marks m ON m.student_id=s.id
      WHERE s.id=$1
    `, [req.params.studentId]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const buf = await generateMarksheet(student);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="marksheet-${student.roll_no}.docx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/admit-card-pdf/:studentId
router.get('/admit-card-pdf/:studentId', async (req, res, next) => {
  try {
    const student = await db.get(`
      SELECT s.*, c.name as center_name, c.district, c.incharge_name
      FROM students s LEFT JOIN centers c ON s.center_id=c.id
      WHERE s.id=$1
    `, [req.params.studentId]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const buf = await generateCertificate(student, 'admit_card', { noBg: req.query.no_bg === '1' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="admit-card-${student.roll_no}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/admit-cards-pdf
router.get('/admit-cards-pdf', async (req, res, next) => {
  try {
    const students = await getStudents(req.query);
    if (!students.length) return res.status(404).json({ error: 'No students found' });

    const buf = await generateCertificateBulk(students, 'admit_card', { noBg: req.query.no_bg === '1' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="admit-cards.pdf"');
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/certificate/:studentId?cert_type=senior_diploma_final
router.get('/certificate/:studentId', async (req, res, next) => {
  try {
    const certType = req.query.cert_type || 'senior_diploma_final';
    if (!VALID_CERT_TYPES.has(certType)) return res.status(400).json({ error: 'Invalid cert_type' });

    const student = await db.get(`
      SELECT s.*, c.name as center_name, c.district, c.incharge_name, c.address as center_address, c.state as center_state,
             m.division, m.distinction, m.certificate_no, m.total_marks, m.marksheet_date
      FROM students s
      LEFT JOIN centers c ON s.center_id=c.id
      LEFT JOIN marks m ON m.student_id=s.id
      WHERE s.id=$1
    `, [req.params.studentId]);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!student.certificate_no)
      return res.status(422).json({ error: 'Serial number not assigned for this student', roll_no: student.roll_no });

    const buf = await generateCertificate(student, certType, { noBg: req.query.no_bg === '1' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cert-${student.roll_no}-${certType}.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/certificates
router.get('/certificates', async (req, res, next) => {
  try {
    const certType = req.query.cert_type || 'senior_diploma_final';
    if (!VALID_CERT_TYPES.has(certType)) return res.status(400).json({ error: 'Invalid cert_type' });

    const all = await getStudents(req.query);
    const eligible = all.filter(s => {
      const d = String(s.division || '').trim().toUpperCase();
      return d !== 'AB' && d !== 'ABSENT';
    });
    if (!eligible.length) return res.status(404).json({ error: 'No eligible students found' });

    const noSerial = eligible.filter(s => !s.certificate_no).map(s => s.roll_no);
    if (noSerial.length === eligible.length)
      return res.status(422).json({ error: 'No students have a serial number assigned', missing: noSerial });

    const students = eligible.filter(s => !!s.certificate_no);
    const buf = await generateCertificateBulk(students, certType, { noBg: req.query.no_bg === '1' });
    if (noSerial.length) res.setHeader('X-Skipped-No-Serial', noSerial.join(','));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificates-${certType}-bulk.pdf"`);
    res.send(buf);
  } catch (e) { next(e); }
});

// GET /api/generate/certificates-zip
router.get('/certificates-zip', async (req, res, next) => {
  try {
    const JSZip = require('jszip');
    const certType = req.query.cert_type || 'senior_diploma_final';
    if (!VALID_CERT_TYPES.has(certType)) return res.status(400).json({ error: 'Invalid cert_type' });

    const students = await getStudents(req.query);
    if (!students.length) return res.status(404).json({ error: 'No students found' });

    const zip = new JSZip();
    const noBg = req.query.no_bg === '1';
    for (const student of students) {
      const buf = await generateCertificate(student, certType, { noBg });
      zip.file(`${student.roll_no}-${certType}.pdf`, buf);
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="certificates-${certType}.zip"`);
    res.send(zipBuf);
  } catch (e) { next(e); }
});

// POST /api/generate/upload-template
const multer = require('multer');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
    cb(null, IMAGES_DIR);
  },
  filename: (req, file, cb) => {
    const certType = req.body.cert_type;
    if (!VALID_CERT_TYPES.has(certType)) return cb(new Error('Invalid cert_type'));
    const ext = file.mimetype === 'image/png' ? '.png'
      : file.mimetype === 'image/webp' ? '.webp'
      : '.jpg';
    cb(null, `${certType}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    cb(null, true);
  }
});

router.post('/upload-template', adminOnly, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!VALID_CERT_TYPES.has(req.body.cert_type))
    return res.status(400).json({ error: 'Invalid cert_type' });
  res.json({ success: true, message: `Template saved: ${req.file.filename}`, path: req.file.path });
});

// GET /api/generate/template-status
router.get('/template-status', (req, res) => {
  const status = {};
  Object.entries(IMAGE_FILES).forEach(([certType, candidates]) => {
    status[certType] = candidates.some(f => fs.existsSync(path.join(IMAGES_DIR, f)));
  });
  res.json(status);
});

module.exports = router;
