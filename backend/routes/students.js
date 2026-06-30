const router = require('express').Router();
const db = require('../db/schema');

// Generate roll number: last2(yearA) + last2(yearB) + centerCode + 4-digit serial
// Serial = highest serial already used under this exact prefix, + 1.
// NOTE: center `code` is NOT unique per center_id (many centers share the same
// code), so the serial must be scoped by the resulting prefix itself — not by
// COUNT(*) per center_id, which would let two same-code centers compute the
// same "next" roll number and collide on the UNIQUE constraint.
function generateRollNo(session, centerId) {
  const [y1, y2] = session.split('-');
  const center = db.prepare('SELECT code FROM centers WHERE id = ?').get(centerId);
  const centerCode = (center && center.code) ? center.code : String(centerId);
  const prefix = y1.slice(-2) + y2.slice(-2) + centerCode;
  const expectedLen = prefix.length + 4;
  const rows = db.prepare('SELECT roll_no FROM students WHERE roll_no LIKE ?').all(prefix + '%');
  let maxSerial = 0;
  for (const r of rows) {
    if (!r.roll_no || r.roll_no.length !== expectedLen) continue; // avoid e.g. code "1" matching code "10"/"11" rolls
    const n = parseInt(r.roll_no.slice(prefix.length), 10);
    if (!isNaN(n) && n > maxSerial) maxSerial = n;
  }
  const serial = String(maxSerial + 1).padStart(4, '0');
  return prefix + serial;
}

// GET all students (with optional filters)
router.get('/', (req, res) => {
  const { center_id, year, subject, session } = req.query;
  let query = `
    SELECT s.*, c.name as center_name, c.district, c.code as center_code,
           m.id as marks_id,
           m.total_marks, m.division, m.distinction, m.certificate_no
    FROM students s
    LEFT JOIN centers c ON s.center_id = c.id
    LEFT JOIN marks m ON m.student_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (center_id)                    { query += ' AND s.center_id = ?'; params.push(center_id); }
  if (year)                         { query += ' AND s.year = ?';      params.push(year); }
  if (subject)                      { query += ' AND s.subject = ?';   params.push(subject); }
  if (session)                      { query += ' AND s.session = ?';   params.push(session); }
  if (req.query.unassigned === '1') { query += ' AND s.batch_id IS NULL'; }
  query += ' ORDER BY s.roll_no';

  res.json(db.prepare(query).all(...params));
});

// GET preview of next roll number for a session + center
// Must be defined BEFORE /:id to avoid route collision
router.get('/generate-roll', (req, res) => {
  const { session, center_id } = req.query;
  if (!session || !center_id)
    return res.status(400).json({ error: 'session and center_id are required' });
  res.json({ roll_no: generateRollNo(session, parseInt(center_id)) });
});

// GET single student
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT s.*, c.name as center_name, c.district, c.incharge_name,
           m.*
    FROM students s
    LEFT JOIN centers c ON s.center_id = c.id
    LEFT JOIN marks m ON m.student_id = s.id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  res.json(row);
});

// POST register new student — roll_no is auto-generated
router.post('/', (req, res) => {
  const {
    name, father_name, mother_name, dob,
    year, subject, center_id, session, batch_id,
    exam_date, exam_venue, exam_time
  } = req.body;

  if (!name || !year || !session || !center_id)
    return res.status(400).json({ error: 'name, year, session, and center_id are required' });

  const { gender, nationality, edu_qualification } = req.body;
  // Retry a few times in the rare case two requests compute the same "next"
  // roll number concurrently (generateRollNo + INSERT isn't atomic).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const roll_no = generateRollNo(session, parseInt(center_id));
      const result = db.prepare(`
        INSERT INTO students (roll_no, name, father_name, mother_name, dob,
          year, subject, center_id, session, batch_id, exam_date, exam_venue, exam_time,
          gender, nationality, edu_qualification)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(roll_no, name, father_name, mother_name, dob,
             year, subject || 'PAINTING', center_id, session,
             batch_id || null, exam_date, exam_venue, exam_time,
             gender || null, nationality || 'Indian', edu_qualification || null);

      return res.status(201).json({ id: result.lastInsertRowid, roll_no });
    } catch (e) {
      if (!e.message.includes('UNIQUE')) throw e;
      // fall through and retry with a freshly computed roll number
    }
  }
  res.status(409).json({ error: 'Roll number conflict, please retry' });
});

// POST bulk register from CSV/array
router.post('/bulk', (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0)
    return res.status(400).json({ error: 'students array required' });

  const insert = db.prepare(`
    INSERT OR IGNORE INTO students (roll_no, name, father_name, mother_name, dob,
      year, subject, center_id, session, exam_date, exam_venue, exam_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let inserted = 0;
  const bulkInsert = db.transaction((rows) => {
    for (const s of rows) {
      // Auto-generate roll_no if not provided and session+center_id available
      let roll_no = s.roll_no;
      if (!roll_no && s.session && s.center_id) {
        roll_no = generateRollNo(s.session, parseInt(s.center_id));
      }
      const r = insert.run(
        roll_no, s.name, s.father_name, s.mother_name, s.dob,
        s.year, s.subject || 'PAINTING', s.center_id, s.session,
        s.exam_date, s.exam_venue, s.exam_time
      );
      inserted += r.changes;
    }
  });
  bulkInsert(students);
  res.json({ inserted, skipped: students.length - inserted });
});

// PUT update student
router.put('/:id', (req, res) => {
  const { name, father_name, mother_name, dob, year, subject,
          center_id, session, batch_id, exam_date, exam_venue, exam_time,
          gender, nationality, edu_qualification } = req.body;
  db.prepare(`
    UPDATE students SET name=?, father_name=?, mother_name=?, dob=?,
      year=?, subject=?, center_id=?, session=?, batch_id=?,
      exam_date=?, exam_venue=?, exam_time=?,
      gender=?, nationality=?, edu_qualification=?
    WHERE id=?
  `).run(name, father_name, mother_name, dob, year, subject,
         center_id, session, batch_id || null,
         exam_date, exam_venue, exam_time,
         gender || null, nationality || 'Indian', edu_qualification || null,
         req.params.id);
  res.json({ success: true });
});

// DELETE student
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM marks WHERE student_id=?').run(req.params.id);
  db.prepare('DELETE FROM students WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
