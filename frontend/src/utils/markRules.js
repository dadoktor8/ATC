// Subject/year-specific mark calculation rules ("RULES OF MARKS CALCULATION").
// These rules apply ONLY to subject "Painting". Every other subject falls back
// to the generic percent-of-500 scheme that was already in use.

export const PP_BC_YEARS = [
  'Pre-preparatory 1st', 'Pre-preparatory 2nd', 'Pre-preparatory 3rd',
  'Beginner Class - I', 'Beginner Class - II', 'Beginner Class - III',
];

// For Painting, only these 5 of the 9 IA columns count (Composition, Still Life,
// Landscape, Lettering, Sketch — each /20 = /100). Illustration, Press Layout,
// Book Cover and Poster Design are "rest columns, not needed" for this subject.
export const IA_PAINTING_KEYS = [
  'ia_composition', 'ia_still_life', 'ia_landscape', 'ia_lettering', 'ia_sketch',
];

// Certificate numbers are auto-generated only for these "final" years/classes.
export const CERT_ELIGIBLE_YEARS = [
  'Pre-preparatory 3rd', 'Beginner Class - III', 'Third Year', 'Fifth Year', 'Seventh Year',
];

export function isPaintingSubject(subject) {
  return String(subject || '').trim().toLowerCase() === 'painting';
}

// Which mark columns matter for a given year (used to grey out irrelevant cells
// in the entry grid). Returns null for unknown/non-Painting years (= show all).
export function relevantKeysForYear(year) {
  const y = String(year || '').trim();
  if (PP_BC_YEARS.includes(y)) return ['practical_paper1'];
  if (y === 'First Year') return ['practical_paper1', ...IA_PAINTING_KEYS];
  if (y === 'Second Year') return ['practical_paper1', ...IA_PAINTING_KEYS, 'oral'];
  if (y === 'Third Year' || y === 'Fourth Year')
    return ['practical_paper1', ...IA_PAINTING_KEYS, 'theory_paper1'];
  if (['Fifth Year', 'Sixth Year', 'Seventh Year'].includes(y))
    return ['practical_paper1', 'practical_paper2', ...IA_PAINTING_KEYS, 'theory_paper1', 'theory_paper2'];
  return null;
}

// Reads a raw cell value (string/number/null) into: null (blank), 'AB', or a number.
function readVal(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (String(v).trim().toUpperCase() === 'AB') return 'AB';
  const n = Number(v);
  return isNaN(n) ? null : n;
}
const asNum = (v) => (typeof v === 'number' ? v : 0);

function iaTotalPainting(row) {
  let sum = 0, any = false;
  IA_PAINTING_KEYS.forEach((k) => {
    const v = readVal(row[k]);
    if (typeof v === 'number') { sum += v; any = true; }
  });
  return any ? sum : null;
}

function divisionByThresholds(tm, [firstMin, secondMin, thirdMin]) {
  if (tm >= firstMin) return 'FIRST';
  if (tm >= secondMin) return 'SECOND';
  if (tm >= thirdMin) return 'THIRD';
  return 'FAIL';
}

// ── Pre-preparatory 1st/2nd/3rd, Beginner Class I/II/III ────────────────────
function calcPPBC(row) {
  const p1 = readVal(row.practical_paper1);
  if (p1 === null) return { total: null, division: null, distinction: null, iaTotal: null };
  if (p1 === 'AB') return { total: 'AB', division: 'AB', distinction: null, iaTotal: null };
  const tm = p1;
  return {
    total: tm,
    division: divisionByThresholds(tm, [65, 50, 35]),
    distinction: tm >= 80 ? 'PCL' : null,
    iaTotal: null,
  };
}

// ── First Year ────────────────────────────────────────────────────────────
function calcFirstYear(row) {
  const p1 = readVal(row.practical_paper1);
  const ia = iaTotalPainting(row);
  if (p1 === null && ia === null) return { total: null, division: null, distinction: null, iaTotal: ia };
  if (p1 === 'AB') return { total: 'AB', division: 'AB', distinction: null, iaTotal: ia };
  const p1n = asNum(p1), ian = asNum(ia);
  const tm = p1n + ian;
  return {
    total: tm,
    division: divisionByThresholds(tm, [130, 100, 70]),
    distinction: tm >= 160 ? 'PCL' : null,
    iaTotal: ia,
  };
}

// ── Second Year ───────────────────────────────────────────────────────────
function calcSecondYear(row) {
  const p1 = readVal(row.practical_paper1);
  const ia = iaTotalPainting(row);
  const oral = readVal(row.oral);
  if (p1 === null && ia === null && oral === null)
    return { total: null, division: null, distinction: null, iaTotal: ia };
  if (p1 === 'AB') return { total: 'AB', division: 'AB', distinction: null, iaTotal: ia };
  const p1n = asNum(p1), ian = asNum(ia), oraln = asNum(oral);
  const tm = p1n + ian + oraln;
  const tags = [];
  if (p1n >= 80 && ian >= 80) tags.push('PCL');
  if (oraln >= 40) tags.push('OL');
  return {
    total: tm,
    division: divisionByThresholds(tm, [162.5, 125, 87.5]),
    distinction: tags.length ? tags.join(' & ') : null,
    iaTotal: ia,
  };
}

// ── Third Year & Fourth Year ─────────────────────────────────────────────
function calcThirdFourthYear(row) {
  const p1 = readVal(row.practical_paper1);
  const ia = iaTotalPainting(row);
  const th1 = readVal(row.theory_paper1);
  if (p1 === null && ia === null && th1 === null)
    return { total: null, division: null, distinction: null, iaTotal: ia };
  if (p1 === 'AB') return { total: 'AB', division: 'AB', distinction: null, iaTotal: ia };
  const p1n = asNum(p1), ian = asNum(ia), th1n = asNum(th1);
  const tm = p1n + ian + th1n;
  const theoryAbsent = th1 === 'AB' || th1 === null;
  const tags = [];
  if (p1n >= 80 && ian >= 80) tags.push('PCL');
  if (!theoryAbsent && th1n >= 40) tags.push('TH');
  return {
    total: tm,
    division: theoryAbsent ? 'FAIL' : divisionByThresholds(tm, [162.5, 125, 87.5]),
    distinction: tags.length ? tags.join(' & ') : null,
    iaTotal: ia,
  };
}

// ── Fifth, Sixth & Seventh Year ──────────────────────────────────────────
function calcFifthSixthSeventhYear(row) {
  const p1 = readVal(row.practical_paper1);
  const p2 = readVal(row.practical_paper2);
  const ia = iaTotalPainting(row);
  const th1 = readVal(row.theory_paper1);
  const th2 = readVal(row.theory_paper2);
  if (p1 === null && p2 === null && ia === null && th1 === null && th2 === null)
    return { total: null, division: null, distinction: null, iaTotal: ia };
  if (p1 === 'AB') return { total: 'AB', division: 'AB', distinction: null, iaTotal: ia };
  const p1n = asNum(p1), p2n = asNum(p2), ian = asNum(ia), th1n = asNum(th1), th2n = asNum(th2);
  const tm = p1n + p2n + ian + th1n + th2n;
  const th1Absent = th1 === 'AB' || th1 === null;
  const th2Absent = th2 === 'AB' || th2 === null;
  const tags = [];
  if (p1n >= 80 && p2n >= 80 && ian >= 80) tags.push('PCL');
  if (!th1Absent && !th2Absent && th1n >= 40 && th2n >= 40) tags.push('TH');
  return {
    total: tm,
    division: (th1Absent || th2Absent) ? 'FAIL' : divisionByThresholds(tm, [260, 200, 140]),
    distinction: tags.length ? tags.join(' & ') : null,
    iaTotal: ia,
  };
}

function computePaintingMarks(year, row) {
  const y = String(year || '').trim();
  if (PP_BC_YEARS.includes(y)) return calcPPBC(row);
  if (y === 'First Year') return calcFirstYear(row);
  if (y === 'Second Year') return calcSecondYear(row);
  if (y === 'Third Year' || y === 'Fourth Year') return calcThirdFourthYear(row);
  if (['Fifth Year', 'Sixth Year', 'Seventh Year'].includes(y)) return calcFifthSixthSeventhYear(row);
  return null; // unknown year string — caller falls back to generic
}

// ── Generic fallback (non-Painting subjects): percent-of-500 across all columns ──
const GENERIC_MARK_KEYS = [
  'practical_paper1', 'practical_paper2', 'practical_fabric',
  'ia_composition', 'ia_illustration', 'ia_still_life', 'ia_press_layout',
  'ia_landscape', 'ia_book_cover', 'ia_lettering', 'ia_sketch', 'ia_poster_design',
  'oral', 'theory_paper1', 'theory_paper2',
];
function calcGeneric(row) {
  let total = 0, hasNumeric = false, hasAB = false, allAB = true;
  for (const key of GENERIC_MARK_KEYS) {
    const v = row[key];
    if (v === '' || v === null || v === undefined) { allAB = false; continue; }
    if (String(v).trim().toUpperCase() === 'AB') { hasAB = true; continue; }
    allAB = false;
    const n = Number(v);
    if (!isNaN(n)) { hasNumeric = true; total += n; }
  }
  if (!hasNumeric && !hasAB) return { total: null, division: null, distinction: null, iaTotal: null };
  if (allAB || (!hasNumeric && hasAB)) return { total: 'AB', division: 'AB', distinction: null, iaTotal: null };
  const pct = (total / 500) * 100;
  let division = 'FAIL';
  if (pct >= 75) division = 'FIRST';
  else if (pct >= 55) division = 'SECOND';
  else if (pct >= 35) division = 'THIRD';
  const distinction = division === 'FIRST' && pct >= 85 ? 'PCL' : null;
  return { total, division, distinction, iaTotal: null };
}

// Main entry point: { total, division, distinction, iaTotal }
// total/iaTotal: number | 'AB' | null. division/distinction: string | null.
export function computeMarks(subject, year, row) {
  if (isPaintingSubject(subject)) {
    const result = computePaintingMarks(year, row);
    if (result) return result;
  }
  return calcGeneric(row);
}

export function isCertEligible(subject, year) {
  return isPaintingSubject(subject) && CERT_ELIGIBLE_YEARS.includes(String(year || '').trim());
}

// ATC<centerCode>-<sessionYY>/<last4RollDigits>  e.g. ATC1-26/0003
export function generateCertificateNo(centerCode, session, rollNo) {
  if (!centerCode || !rollNo) return '';
  const sessionYY = String(session || '').split('-')[0]?.trim().slice(-2) || '';
  const roll = String(rollNo).replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `ATC${centerCode}-${sessionYY}/${roll}`;
}
