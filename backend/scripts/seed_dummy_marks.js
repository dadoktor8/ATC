/**
 * Inserts dummy marks for all students in a batch (or all students if no batch given).
 * Usage:
 *   node backend/scripts/seed_dummy_marks.js <batch_id>
 *   node backend/scripts/seed_dummy_marks.js          ← seeds ALL students
 */

const db = require('../db/schema');

const batchId = process.argv[2] || null;

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ~20% chance student is fully absent
function makeMarks(studentIdx) {
  if (studentIdx % 7 === 6) {
    // one in every 7 is absent (AB → store as null, division='AB')
    return {
      practical_paper1: null, practical_paper2: null, practical_fabric: null,
      ia_composition: null, ia_illustration: null, ia_still_life: null,
      ia_press_layout: null, ia_landscape: null, ia_book_cover: null,
      ia_lettering: null, ia_sketch: null, ia_poster_design: null,
      ia_total: 0, oral: null, theory_paper1: null, theory_paper2: null,
      total_marks: null, division: 'AB', distinction: null,
      certificate_no: null,
    };
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
  const ia_total = ia_composition + ia_illustration + ia_still_life +
                   ia_press_layout + ia_landscape + ia_book_cover +
                   ia_lettering + ia_sketch + ia_poster_design;

  const oral    = rnd(30, 50);
  const theory1 = rnd(28, 50);
  const theory2 = rnd(28, 50);

  const total = p1 + p2 + fab + ia_total + oral + theory1 + theory2;

  const pct = (total / 500) * 100;
  let division = 'FAIL';
  if (pct >= 75) division = 'FIRST';
  else if (pct >= 55) division = 'SECOND';
  else if (pct >= 35) division = 'THIRD';

  const distinction = division === 'FIRST' && pct >= 85 ? 'PCL' : null;

  return {
    practical_paper1: p1, practical_paper2: p2, practical_fabric: fab,
    ia_composition, ia_illustration, ia_still_life,
    ia_press_layout, ia_landscape, ia_book_cover,
    ia_lettering, ia_sketch, ia_poster_design,
    ia_total, oral, theory_paper1: theory1, theory_paper2: theory2,
    total_marks: total, division, distinction,
    certificate_no: null,
  };
}

const students = batchId
  ? db.prepare('SELECT id, roll_no, name FROM students WHERE batch_id = ? ORDER BY CAST(roll_no AS INTEGER)').all(batchId)
  : db.prepare('SELECT id, roll_no, name FROM students ORDER BY CAST(roll_no AS INTEGER)').all();

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

const seedAll = db.transaction(() => {
  students.forEach((s, idx) => {
    const m = makeMarks(idx);
    upsert.run(
      s.id,
      m.practical_paper1, m.practical_paper2, m.practical_fabric,
      m.ia_composition, m.ia_illustration, m.ia_still_life,
      m.ia_press_layout, m.ia_landscape, m.ia_book_cover,
      m.ia_lettering, m.ia_sketch, m.ia_poster_design,
      m.ia_total, m.oral, m.theory_paper1, m.theory_paper2,
      m.total_marks, m.division, m.distinction, m.certificate_no,
      'seed-script'
    );
    const tag = m.division === 'AB' ? '(AB)' : `→ ${m.total_marks} [${m.division}]`;
    console.log(`  ${String(idx+1).padStart(3)}. ${s.name.padEnd(28)} ${tag}`);
  });
});

console.log(`\nSeeding marks for ${students.length} student(s)${batchId ? ` in batch ${batchId}` : ''}...\n`);
seedAll();
console.log(`\nDone. Regenerate the allocation sheet PDF to see the marks.\n`);
