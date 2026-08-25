const router = require('express').Router();
const db = require('../db/client');
const { adminOnly } = require('../middleware/auth');

async function generateBatchCode(session) {
  const year = session.split('-')[0];
  const prefix = `BTCH${year}-`;
  const expectedLen = prefix.length + 2;
  const rows = await db.all('SELECT batch_code FROM batches WHERE batch_code LIKE $1', [prefix + '%']);
  let maxSerial = 0;
  for (const r of rows) {
    if (!r.batch_code || r.batch_code.length !== expectedLen) continue;
    const n = parseInt(r.batch_code.slice(prefix.length), 10);
    if (!isNaN(n) && n > maxSerial) maxSerial = n;
  }
  return prefix + String(maxSerial + 1).padStart(2, '0');
}

// GET /api/batches
router.get('/', async (req, res) => {
  const { center_id, session, status, year } = req.query;
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
  if (center_id) { q += ` AND b.center_id=$${params.length + 1}`; params.push(center_id); }
  if (session)   { q += ` AND b.session=$${params.length + 1}`;   params.push(session); }
  if (status)    { q += ` AND b.status=$${params.length + 1}`;    params.push(status); }
  if (year)      { q += ` AND b.year=$${params.length + 1}`;      params.push(year); }
  q += ' GROUP BY b.id, c.name, c.code, c.incharge_name, c.co_name, c.address ORDER BY b.created_at DESC';
  res.json(await db.all(q, params));
});

// GET /api/batches/:id
router.get('/:id', async (req, res) => {
  const row = await db.get(`
    SELECT b.*, c.name as center_name, c.code as center_code,
           c.incharge_name as center_teacher, c.co_name, c.address as center_address,
           COUNT(s.id) as student_count
    FROM batches b
    LEFT JOIN centers c ON b.center_id = c.id
    LEFT JOIN students s ON s.batch_id = b.id
    WHERE b.id=$1
    GROUP BY b.id, c.name, c.code, c.incharge_name, c.co_name, c.address
  `, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Batch not found' });
  res.json(row);
});

// GET /api/batches/:id/students
router.get('/:id/students', async (req, res) => {
  const students = await db.all(`
    SELECT s.*, c.name as center_name,
           m.total_marks, m.division, m.distinction,
           m.practical_paper1, m.practical_paper2, m.practical_fabric,
           m.ia_composition, m.ia_illustration, m.ia_still_life,
           m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
           m.ia_lettering, m.ia_sketch, m.ia_poster_design,
           m.ia_total, m.oral, m.theory_paper1, m.theory_paper2
    FROM students s
    LEFT JOIN centers c ON s.center_id = c.id
    LEFT JOIN marks m ON m.student_id = s.id
    WHERE s.batch_id=$1
    ORDER BY s.roll_no
  `, [req.params.id]);
  res.json(students);
});

// POST /api/batches — create a new batch
router.post('/', adminOnly, async (req, res) => {
  const { center_id, session, year, subject, status } = req.body;
  if (!center_id || !session || !year)
    return res.status(400).json({ error: 'center_id, session, year are required' });

  const batch_code = await generateBatchCode(session);
  try {
    const r = await db.run(
      `INSERT INTO batches (batch_code, center_id, session, year, subject, from_date, to_date, status)
       VALUES ($1,$2,$3,$4,$5,'','',$6) RETURNING id`,
      [batch_code, center_id, session, year, subject || null, status || 'active']
    );
    res.status(201).json({ id: r.id, batch_code });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Batch code conflict, retry' });
    throw e;
  }
});

// PUT /api/batches/:id
router.put('/:id', adminOnly, async (req, res) => {
  const { center_id, session, year, subject, status } = req.body;
  await db.run(
    `UPDATE batches SET center_id=$1, session=$2, year=$3, subject=$4, status=$5 WHERE id=$6`,
    [center_id, session, year, subject || null, status, req.params.id]
  );
  res.json({ success: true });
});

// POST /api/batches/auto
router.post('/auto', adminOnly, async (req, res) => {
  const { center_id, session } = req.body;
  if (!center_id || !session)
    return res.status(400).json({ error: 'center_id and session required' });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const batch_code = await generateBatchCode(session);
      const r = await db.run(
        `INSERT INTO batches (batch_code, center_id, session, from_date, to_date, status)
         VALUES ($1,$2,$3,'','',$4) RETURNING id`,
        [batch_code, center_id, session, 'active']
      );
      return res.status(201).json({ id: r.id, batch_code, created: true });
    } catch (e) {
      if (e.code !== '23505') throw e;
    }
  }
  res.status(409).json({ error: 'Batch code conflict, please retry' });
});

// POST /api/batches/:id/assign — bulk-assign student IDs to this batch
router.post('/:id/assign', adminOnly, async (req, res) => {
  const { student_ids } = req.body;
  if (!Array.isArray(student_ids) || student_ids.length === 0)
    return res.status(400).json({ error: 'student_ids array required' });

  await db.transaction(async (tx) => {
    for (const id of student_ids) {
      await tx.run('UPDATE students SET batch_id=$1 WHERE id=$2', [req.params.id, id]);
    }
  });
  res.json({ assigned: student_ids.length });
});

// DELETE /api/batches/:id/students/:studentId
router.delete('/:id/students/:studentId', adminOnly, async (req, res) => {
  await db.run('UPDATE students SET batch_id=NULL WHERE id=$1 AND batch_id=$2',
    [req.params.studentId, req.params.id]);
  res.json({ success: true });
});

// DELETE /api/batches/:id
router.delete('/:id', adminOnly, async (req, res) => {
  const row = await db.get('SELECT COUNT(*) as cnt FROM students WHERE batch_id=$1', [req.params.id]);
  if (Number(row.cnt) > 0)
    return res.status(409).json({ error: `Cannot delete: ${row.cnt} student(s) still assigned to this batch` });
  await db.run('DELETE FROM batches WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
