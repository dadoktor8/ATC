/**
 * Inserts dummy marks for all students in a batch (or all students if no batch given).
 * Marks are generated per the year-specific Painting rules (utils/markRules.js) when
 * subject is Painting; other subjects fall back to a generic spread across all columns.
 * Usage:
 *   node backend/scripts/seed_dummy_marks.js <batch_id>
 *   node backend/scripts/seed_dummy_marks.js          ← seeds ALL students
 */

const db = require('../db/schema');
const {
  PP_BC_YEARS, isPaintingSubject, computeMarks, isCertEligible, generateCertificateNo,
} = require('../utils/markRules');

const batchId = process.argv[2] || null;

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FULL_NULL_ROW = {
  practical_paper1: null, practical_paper2: null, practical_fabric: null,
  ia_composition: null, ia_illustration: null, ia_still_life: null,
  ia_press_layout: null, ia_landscape: null, ia_book_cover: null,
  ia_lettering: null, ia_sketch: null, ia_poster_design: null,
  oral: null, theory_paper1: null, theory_paper2: null,
};

// Raw, random per-field values appropriate to the student's year/subject.
// ~1 in 7 students is fully absent. For years with a theory exception clause,
// occasionally mark just that paper "AB" to exercise the absence rule.
function makeRawMarks(studentIdx, year, subject) {
  if (studentIdx % 7 === 6) {
    return { ...FULL_NULL_ROW, practical_paper1: 'AB' };
  }

  const p1  = rnd(55, 95);
  const p2  = rnd(55, 95);
  const fab = rnd(50, 90);
  const ia_composition  = rnd(12, 20);
  const ia_illustration = rnd(12, 20);
  const ia_still_life   = rnd(12, 20);
  const ia_press_layout = rnd(10, 20);
  const ia_landscape    = rnd(12, 20);
  const ia_book_cover   = rnd(10, 20);
  const ia_lettering    = rnd(12, 20);
  const ia_sketch       = rnd(12, 20);
  const ia_poster_design= rnd(10, 20);
  const oral    = rnd(30, 50);
  let theory1   = rnd(28, 50);
  let theory2   = rnd(28, 50);

  // ~1 in 11 students in a theory-bearing year gets a single absent theory paper,
  // to demonstrate the "Theory absent → Fail" exception rule.
  const isPainting = isPaintingSubject(subject);
  if (isPainting && studentIdx % 11 === 5) {
    if (PP_BC_YEARS.includes(year) || year === 'First Year') {
      // no theory papers in these years — nothing to mark absent
    } else if (year === 'Third Year' || year === 'Fourth Year') {
      theory1 = 'AB';
    } else if (['Fifth Year', 'Sixth Year', 'Seventh Year'].includes(year)) {
      theory2 = 'AB';
    }
  }

  return {
    practical_paper1: p1, practical_paper2: p2, practical_fabric: fab,
    ia_composition, ia_illustration, ia_still_life,
    ia_press_layout, ia_landscape, ia_book_cover,
    ia_lettering, ia_sketch, ia_poster_design,
    oral, theory_paper1: theory1, theory_paper2: theory2,
  };
}

const students = batchId
  ? db.prepare(`
      SELECT s.id, s.roll_no, s.name, s.year, s.subject, s.session, c.code as center_code
      FROM students s LEFT JOIN centers c ON s.center_id = c.id
      WHERE s.batch_id = ? ORDER BY CAST(s.roll_no AS INTEGER)
    `).all(batchId)
  : db.prepare(`
      SELECT s.id, s.roll_no, s.name, s.year, s.subject, s.session, c.code as center_code
      FROM students s LEFT JOIN centers c ON s.center_id = c.id
      ORDER BY CAST(s.roll_no AS INTEGER)
    `).all();

if (!students.length) {
  console.error(`No students found${batchId ? ` in batch ${batchId}` : ''}.`);
  process.exit(1);
}

const upsert = db.prepare(`
  INSERT INTO marks (
    student_id, practical_paper1, practical_paper2, practical_fabric,
    ia_composition, ia_illustration, ia_still_life,
    ia_press_layout, ia_landscape, ia_book_cover,
    ia_lettering, ia_sketch, ia_poster_design,
    ia_total, oral, theory_paper1, theory_paper2,
    total_marks, division, distinction, certificate_no, entered_by
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(student_id) DO UPDATE SET
    practical_paper1=excluded.practical_paper1, practical_paper2=excluded.practical_paper2,
    practical_fabric=excluded.practical_fabric,
    ia_composition=excluded.ia_composition, ia_illustration=excluded.ia_illustration,
    ia_still_life=excluded.ia_still_life, ia_press_layout=excluded.ia_press_layout,
    ia_landscape=excluded.ia_landscape, ia_book_cover=excluded.ia_book_cover,
    ia_lettering=excluded.ia_lettering, ia_sketch=excluded.ia_sketch,
    ia_poster_design=excluded.ia_poster_design,
    ia_total=excluded.ia_total, oral=excluded.oral,
    theory_paper1=excluded.theory_paper1, theory_paper2=excluded.theory_paper2,
    total_marks=excluded.total_marks, division=excluded.division,
    distinction=excluded.distinction, certificate_no=excluded.certificate_no,
    entered_by=excluded.entered_by, updated_at=datetime('now')
`);

// Converts 'AB' / number / null cell values to what the marks table stores (null for AB).
function toDbVal(v) {
  if (v === 'AB' || v === null || v === undefined || v === '') return null;
  return v;
}

const seedAll = db.transaction(() => {
  students.forEach((s, idx) => {
    const raw = makeRawMarks(idx, s.year, s.subject);
    const calc = computeMarks(s.subject, s.year, raw);

    const totalMarks = typeof calc.total === 'number' ? calc.total : null;
    const division = calc.division || null;
    const distinction = calc.distinction || null;
    const iaTotal = typeof calc.iaTotal === 'number' ? calc.iaTotal : 0;

    let certNo = null;
    if (division !== 'AB' && isCertEligible(s.subject, s.year)) {
      certNo = generateCertificateNo(s.center_code, s.session, s.roll_no) || null;
    }

    upsert.run(
      s.id,
      toDbVal(raw.practical_paper1), toDbVal(raw.practical_paper2), toDbVal(raw.practical_fabric),
      toDbVal(raw.ia_composition), toDbVal(raw.ia_illustration), toDbVal(raw.ia_still_life),
      toDbVal(raw.ia_press_layout), toDbVal(raw.ia_landscape), toDbVal(raw.ia_book_cover),
      toDbVal(raw.ia_lettering), toDbVal(raw.ia_sketch), toDbVal(raw.ia_poster_design),
      iaTotal, toDbVal(raw.oral), toDbVal(raw.theory_paper1), toDbVal(raw.theory_paper2),
      totalMarks, division, distinction, certNo,
      'seed-script'
    );
    const tag = division === 'AB' ? '(AB)' : `→ ${totalMarks} [${division}]${distinction ? ' ' + distinction : ''}`;
    console.log(`  ${String(idx+1).padStart(3)}. ${s.name.padEnd(28)} ${s.year.padEnd(22)} ${tag}`);
  });
});

console.log(`\nSeeding marks for ${students.length} student(s)${batchId ? ` in batch ${batchId}` : ''}...\n`);
seedAll();
console.log(`\nDone. Regenerate the marksheet/allocation sheet PDF to see the marks.\n`);
