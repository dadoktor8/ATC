const router = require('express').Router();
const db = require('../db/schema');
const { adminOnly } = require('../middleware/auth');

// Auto-generate batch code: BTCH{sessionYear}-{02d sequential}
function generateBatchCode(session) {
  const year = session.split('-')[0];
  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM batches WHERE session=?').get(session);
  return `BTCH${year}-${String(cnt + 1).padStart(2, '0')}`;
}

// GET /api/batches — list with optional center_id / session / status filters
router.get('/', (req, res) => {
  const { center_id, session, status } = req.query;
  let q = `
    SELECT b.*, c.name as center_name, c.code as center_code,
           c.incharge_name as center_teacher, c.co_name, c.address as center_address,
           COUNT(s.id) as student_count
    FROM batches b
    LEFT JOIN centers c ON b.center_id = c.id
    LEFT JOIN students s ON s.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];
  if (center_id) { q += ' AND b.center_id=?'; params.push(center_id); }
  if (session)   { q += ' AND b.session=?';   params.push(session); }
  if (status)    { q += ' AND b.status=?';    params.push(status); }
  q += ' GROUP BY b.id ORDER BY b.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

// GET /api/batches/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT b.*, c.name as center_name, c.code as center_code,
           c.incharge_name as center_teacher, c.co_name, c.address as center_address,
           COUNT(s.id) as student_count
    FROM batches b
    LEFT JOIN centers c ON b.center_id = c.id
    LEFT JOIN students s ON s.batch_id = b.id
    WHERE b.id=?
    GROUP BY b.id
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Batch not found' });
  res.json(row);
});

// GET /api/batches/:id/students
router.get('/:id/students', (req, res) => {
  const students = db.prepare(`
    SELECT s.*, c.name as center_name
    FROM students s
    LEFT JOIN centers c ON s.center_id = c.id
    WHERE s.batch_id=?
    ORDER BY s.roll_no
  `).all(req.params.id);
  res.json(students);
});

// POST /api/batches — create a new batch
router.post('/', adminOnly, (req, res) => {
  const { center_id, session, year, subject, status } = req.body;
  if (!center_id || !session || !year)
    return res.status(400).json({ error: 'center_id, session, year are required' });

  const batch_code = generateBatchCode(session);
  try {
    const r = db.prepare(`
      INSERT INTO batches (batch_code, center_id, session, year, subject, from_date, to_date, status)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(batch_code, center_id, session, year, subject || null, '', '', status || 'active');
    res.status(201).json({ id: r.lastInsertRowid, batch_code });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Batch code conflict, retry' });
    throw e;
  }
});

// PUT /api/batches/:id
router.put('/:id', adminOnly, (req, res) => {
  const { center_id, session, year, subject, status } = req.body;
  db.prepare(`
    UPDATE batches
    SET center_id=?, session=?, year=?, subject=?, status=?
    WHERE id=?
  `).run(center_id, session, year, subject || null, status, req.params.id);
  res.json({ success: true });
});

// POST /api/batches/auto — always create a fresh batch for this registration session
router.post('/auto', adminOnly, (req, res) => {
  const { center_id, session } = req.body;
  if (!center_id || !session)
    return res.status(400).json({ error: 'center_id and session required' });

  const batch_code = generateBatchCode(session);
  const r = db.prepare(`
    INSERT INTO batches (batch_code, center_id, session, from_date, to_date, status)
    VALUES (?,?,?,?,?,?)
  `).run(batch_code, center_id, session, '', '', 'active');

  res.status(201).json({ id: r.lastInsertRowid, batch_code, created: true });
});

// POST /api/batches/:id/assign — bulk-assign student IDs to this batch
router.post('/:id/assign', adminOnly, (req, res) => {
  const { student_ids } = req.body;
  if (!Array.isArray(student_ids) || student_ids.length === 0)
    return res.status(400).json({ error: 'student_ids array required' });
  const update = db.prepare('UPDATE students SET batch_id=? WHERE id=?');
  const run = db.transaction((ids) => { for (const id of ids) update.run(req.params.id, id); });
  run(student_ids);
  res.json({ assigned: student_ids.length });
});

// DELETE /api/batches/:id/students/:studentId — remove student from batch
router.delete('/:id/students/:studentId', adminOnly, (req, res) => {
  db.prepare('UPDATE students SET batch_id=NULL WHERE id=? AND batch_id=?')
    .run(req.params.studentId, req.params.id);
  res.json({ success: true });
});

// DELETE /api/batches/:id — blocked if students are assigned
router.delete('/:id', adminOnly, (req, res) => {
  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM students WHERE batch_id=?').get(req.params.id);
  if (cnt > 0)
    return res.status(409).json({ error: `Cannot delete: ${cnt} student(s) still assigned to this batch` });
  db.prepare('DELETE FROM batches WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
