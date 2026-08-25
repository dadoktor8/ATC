const router = require('express').Router();
const db = require('../db/client');
const { adminOnly } = require('../middleware/auth');

async function generateRollNo(session, centerId) {
  const [y1, y2] = session.split('-');
  const center = await db.get('SELECT code FROM centers WHERE id=$1', [centerId]);
  const centerCode = (center && center.code) ? center.code : String(centerId);
  const prefix = y1.slice(-2) + y2.slice(-2) + centerCode;
  const expectedLen = prefix.length + 4;
  const rows = await db.all('SELECT roll_no FROM students WHERE roll_no LIKE $1', [prefix + '%']);
  let maxSerial = 0;
  for (const r of rows) {
    if (!r.roll_no || r.roll_no.length !== expectedLen) continue;
    const n = parseInt(r.roll_no.slice(prefix.length), 10);
    if (!isNaN(n) && n > maxSerial) maxSerial = n;
  }
  return prefix + String(maxSerial + 1).padStart(4, '0');
}

// GET all students (with optional filters)
router.get('/', async (req, res) => {
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
  if (center_id)                    { query += ` AND s.center_id=$${params.length + 1}`; params.push(center_id); }
  if (year)                         { query += ` AND s.year=$${params.length + 1}`;      params.push(year); }
  if (subject)                      { query += ` AND s.subject=$${params.length + 1}`;   params.push(subject); }
  if (session)                      { query += ` AND s.session=$${params.length + 1}`;   params.push(session); }
  if (req.query.unassigned === '1') { query += ' AND s.batch_id IS NULL'; }
  query += ' ORDER BY s.roll_no';
  res.json(await db.all(query, params));
});

// GET preview of next roll number
router.get('/generate-roll', async (req, res) => {
  const { session, center_id } = req.query;
  if (!session || !center_id)
    return res.status(400).json({ error: 'session and center_id are required' });
  res.json({ roll_no: await generateRollNo(session, parseInt(center_id)) });
});

// GET single student
router.get('/:id', async (req, res) => {
  const row = await db.get(`
    SELECT s.*, c.name as center_name, c.district, c.incharge_name,
           m.*
    FROM students s
    LEFT JOIN centers c ON s.center_id = c.id
    LEFT JOIN marks m ON m.student_id = s.id
    WHERE s.id=$1
  `, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Student not found' });
  res.json(row);
});

// POST register new student
router.post('/', adminOnly, async (req, res) => {
  const {
    name, father_name, mother_name, dob,
    year, subject, center_id, session, batch_id,
    exam_date, exam_venue, exam_time, gender, nationality, edu_qualification
  } = req.body;

  if (!name || !year || !session || !center_id)
    return res.status(400).json({ error: 'name, year, session, and center_id are required' });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const roll_no = await generateRollNo(session, parseInt(center_id));
      const r = await db.run(
        `INSERT INTO students
           (roll_no, name, father_name, mother_name, dob,
            year, subject, center_id, session, batch_id,
            exam_date, exam_venue, exam_time,
            gender, nationality, edu_qualification)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [roll_no, name, father_name, mother_name, dob,
         year, subject || 'PAINTING', center_id, session,
         batch_id || null, exam_date, exam_venue, exam_time,
         gender || null, nationality || 'Indian', edu_qualification || null]
      );
      return res.status(201).json({ id: r.id, roll_no });
    } catch (e) {
      if (e.code !== '23505') throw e;
    }
  }
  res.status(409).json({ error: 'Roll number conflict, please retry' });
});

// POST bulk register
router.post('/bulk', adminOnly, async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0)
    return res.status(400).json({ error: 'students array required' });

  let inserted = 0;
  await db.transaction(async (tx) => {
    for (const s of students) {
      let roll_no = s.roll_no;
      if (!roll_no && s.session && s.center_id) {
        roll_no = await generateRollNo(s.session, parseInt(s.center_id));
      }
      const r = await tx.run(
        `INSERT INTO students
           (roll_no, name, father_name, mother_name, dob,
            year, subject, center_id, session, exam_date, exam_venue, exam_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (roll_no) DO NOTHING RETURNING id`,
        [roll_no, s.name, s.father_name, s.mother_name, s.dob,
         s.year, s.subject || 'PAINTING', s.center_id, s.session,
         s.exam_date, s.exam_venue, s.exam_time]
      );
      inserted += r.changes;
    }
  });
  res.json({ inserted, skipped: students.length - inserted });
});

// PUT update student
router.put('/:id', adminOnly, async (req, res) => {
  const { name, father_name, mother_name, dob, year, subject,
          center_id, session, batch_id, exam_date, exam_venue, exam_time,
          gender, nationality, edu_qualification } = req.body;
  await db.run(
    `UPDATE students SET
       name=$1, father_name=$2, mother_name=$3, dob=$4,
       year=$5, subject=$6, center_id=$7, session=$8, batch_id=$9,
       exam_date=$10, exam_venue=$11, exam_time=$12,
       gender=$13, nationality=$14, edu_qualification=$15
     WHERE id=$16`,
    [name, father_name, mother_name, dob, year, subject,
     center_id, session, batch_id || null,
     exam_date, exam_venue, exam_time,
     gender || null, nationality || 'Indian', edu_qualification || null,
     req.params.id]
  );
  res.json({ success: true });
});

// DELETE student
router.delete('/:id', adminOnly, async (req, res) => {
  await db.run('DELETE FROM marks WHERE student_id=$1', [req.params.id]);
  await db.run('DELETE FROM students WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
