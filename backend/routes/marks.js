const router = require('express').Router();
const db = require('../db/client');
const { computeMarks } = require('../utils/markRules');

function calcDivision(total, maxMarks) {
  if (!total) return null;
  const pct = (total / maxMarks) * 100;
  if (pct >= 75) return 'FIRST';
  if (pct >= 55) return 'SECOND';
  if (pct >= 35) return 'THIRD';
  return 'FAIL';
}

function calcIATotal(m) {
  return [
    m.ia_composition, m.ia_illustration, m.ia_still_life,
    m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
    m.ia_lettering, m.ia_sketch, m.ia_poster_design
  ].reduce((a, v) => a + (v || 0), 0);
}

function calcTotal(m) {
  const practical = (m.practical_paper1 || 0) + (m.practical_paper2 || 0) + (m.practical_fabric || 0);
  const ia = m.ia_total || calcIATotal(m);
  const oral = (m.oral || 0) + (m.theory_paper1 || 0) + (m.theory_paper2 || 0);
  return practical + ia + oral;
}

// GET all students + marks for a batch
router.get('/batch/:batchId', async (req, res) => {
  const batch = await db.get(`
    SELECT b.*, c.name as center_name, c.code as center_code
    FROM batches b LEFT JOIN centers c ON b.center_id = c.id
    WHERE b.id=$1
  `, [req.params.batchId]);

  const students = await db.all(`
    SELECT s.id, s.roll_no, s.name, s.year, s.subject, s.session,
           c.code as center_code, c.name as center_name,
           m.practical_paper1, m.practical_paper2, m.practical_fabric,
           m.ia_composition, m.ia_illustration, m.ia_still_life,
           m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
           m.ia_lettering, m.ia_sketch, m.ia_poster_design,
           m.ia_total, m.oral, m.theory_paper1, m.theory_paper2,
           m.total_marks, m.division, m.distinction, m.certificate_no
    FROM students s
    LEFT JOIN centers c ON s.center_id = c.id
    LEFT JOIN marks m ON m.student_id = s.id
    WHERE s.batch_id=$1
    ORDER BY CAST(s.roll_no AS INTEGER)
  `, [req.params.batchId]);

  res.json({ batch: batch || null, students });
});

// GET marks for a student
router.get('/:studentId', async (req, res) => {
  const row = await db.get('SELECT * FROM marks WHERE student_id=$1', [req.params.studentId]);
  res.json(row || null);
});

// POST / PUT upsert marks
router.post('/:studentId', async (req, res) => {
  const sid = req.params.studentId;
  const student = await db.get('SELECT id, year, subject FROM students WHERE id=$1', [sid]);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const m = req.body;
  const needsFallback = m.total_marks == null || m.division == null;
  const fallback = needsFallback ? computeMarks(student.subject, student.year, m) : null;

  const iaTotal = m.ia_total != null ? m.ia_total
    : (fallback && typeof fallback.iaTotal === 'number') ? fallback.iaTotal
    : calcIATotal(m);
  const total = m.total_marks != null ? m.total_marks
    : (fallback && fallback.total != null) ? fallback.total
    : calcTotal({ ...m, ia_total: iaTotal });
  const division = m.division != null ? m.division
    : (fallback && fallback.division) ? fallback.division
    : calcDivision(total, 500);
  const distinction = m.distinction != null ? m.distinction
    : (fallback && fallback.distinction) ? fallback.distinction
    : null;

  const enteredBy = req.user.username;
  const existing = await db.get('SELECT id FROM marks WHERE student_id=$1', [sid]);

  if (existing) {
    await db.run(`
      UPDATE marks SET
        practical_paper1=$1, practical_paper2=$2, practical_fabric=$3,
        ia_composition=$4, ia_illustration=$5, ia_still_life=$6,
        ia_press_layout=$7, ia_landscape=$8, ia_book_cover=$9,
        ia_lettering=$10, ia_sketch=$11, ia_poster_design=$12,
        ia_total=$13, oral=$14, theory_paper1=$15, theory_paper2=$16,
        total_marks=$17, division=$18, distinction=$19, certificate_no=$20,
        entered_by=$21, updated_at=NOW()
      WHERE student_id=$22
    `, [
      m.practical_paper1, m.practical_paper2, m.practical_fabric,
      m.ia_composition, m.ia_illustration, m.ia_still_life,
      m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
      m.ia_lettering, m.ia_sketch, m.ia_poster_design,
      iaTotal, m.oral, m.theory_paper1, m.theory_paper2,
      total, division, distinction, m.certificate_no,
      enteredBy, sid
    ]);
  } else {
    await db.run(`
      INSERT INTO marks (
        student_id, practical_paper1, practical_paper2, practical_fabric,
        ia_composition, ia_illustration, ia_still_life,
        ia_press_layout, ia_landscape, ia_book_cover,
        ia_lettering, ia_sketch, ia_poster_design,
        ia_total, oral, theory_paper1, theory_paper2,
        total_marks, division, distinction, certificate_no, entered_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    `, [
      sid,
      m.practical_paper1, m.practical_paper2, m.practical_fabric,
      m.ia_composition, m.ia_illustration, m.ia_still_life,
      m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
      m.ia_lettering, m.ia_sketch, m.ia_poster_design,
      iaTotal, m.oral, m.theory_paper1, m.theory_paper2,
      total, division, distinction, m.certificate_no, enteredBy
    ]);
  }

  res.json({ success: true, total_marks: total, division, distinction, ia_total: iaTotal });
});

module.exports = router;
