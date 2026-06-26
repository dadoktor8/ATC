const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageOrientation
} = require('docx');

const b6 = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const b4 = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const allB = { top: b6, bottom: b6, left: b4, right: b4 };

// ── table cell helper ────────────────────────────────────────────────────────
function c(text, opts = {}) {
  return new TableCell({
    borders: opts.borders || allB,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    rowSpan: opts.rowSpan,
    columnSpan: opts.colSpan,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.CENTER,
      children: [new TextRun({
        text: String(text ?? ''),
        bold: opts.bold !== false,
        size: opts.size || 16,
        font: 'Arial'
      })]
    })]
  });
}

// ── paragraph helpers ────────────────────────────────────────────────────────
// Top-left info: Calibri, 10 pt (20 half-pts)
function infoPara(text, { bold = false, after = 40 } = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after },
    children: [new TextRun({ text: String(text ?? ''), bold, size: 20, font: 'Calibri' })]
  });
}

// Center code / session label: Arial Black, 12 pt (24 half-pts), red
function redLabel(text) {
  return new TextRun({ text, bold: true, size: 24, font: 'Arial Black', color: 'FF0000' });
}

// ── marks table column headers ────────────────────────────────────────────────
const MARKS_HEADERS = [
  { label: '1ST PAPER\n100', width: 500 },
  { label: '2ND PAPER\n100', width: 500 },
  { label: 'FABRIC\n100', width: 500 },
  { label: 'COMPOSITION\n20', width: 440 },
  { label: 'ILLUSTRATION\n20', width: 440 },
  { label: 'STILL LIFE\n20', width: 440 },
  { label: 'PRESS LAYOUT\n20', width: 440 },
  { label: 'LANDSCAPE\n20', width: 440 },
  { label: 'BOOK COVER\n20', width: 440 },
  { label: 'LETTERING\n20', width: 440 },
  { label: 'SKETCH\n20', width: 440 },
  { label: 'POSTER DESIGN\n20', width: 440 },
  { label: 'TOTAL IN ASSESSMENT\n100', width: 540 },
  { label: 'ORAL\n50', width: 420 },
  { label: 'PAPER-I\n50', width: 420 },
  { label: 'PAPER-II\n50', width: 420 },
];

function buildHeaderRows(withMarks) {
  const baseRow1Cells = [
    c('SL.NO.',             { rowSpan: 3, width: 400 }),
    c('ROLL NO.',           { rowSpan: 3, width: 500 }),
    c('NAME OF EXAMINEES',  { rowSpan: 3, width: 1800, shading: 'F0F0F0' }),
    c('YEAR',               { rowSpan: 3, width: 500 }),
    c('SUBJECT',            { rowSpan: 3, width: 600 }),
  ];

  if (withMarks) {
    baseRow1Cells.push(
      c('MARK OBTAINED BY THE EXAMINEES', { colSpan: 16, shading: 'DDEEFF' }),
      c('TOTAL MARKS',  { rowSpan: 3, width: 540 }),
      c('DIVISION',     { rowSpan: 3, width: 500 }),
      c('DISTINCTION',  { rowSpan: 3, width: 500 }),
      c('CERTIFICATE NO.', { rowSpan: 3, width: 700 }),
    );
  } else {
    baseRow1Cells.push(
      c('ROOM NO.', { rowSpan: 3, width: 500 }),
      c('SEAT NO.', { rowSpan: 3, width: 500 }),
    );
  }

  const row2 = withMarks ? new TableRow({ children: [
    c('PRACTICAL',           { colSpan: 3,  shading: 'FFEEDD' }),
    c('INTERNAL ASSESSMENT', { colSpan: 10, shading: 'EEFFDD' }),
    c('ORAL AND THEORETICAL',{ colSpan: 3,  shading: 'DDEEFF' }),
  ]}) : null;

  const row3Cells = withMarks
    ? MARKS_HEADERS.map(h => c(h.label, { bold: true, size: 14, width: h.width }))
    : [];

  return { baseRow1Cells, row2, row3Cells };
}

function studentDataRow(s, idx, withMarks) {
  const baseCells = [
    c(`${String(idx + 1).padStart(2, '0')}.`, { bold: false }),
    c(s.roll_no, { bold: true }),
    c(s.name, { bold: true, align: AlignmentType.LEFT }),
    c(s.year, { bold: false }),
    c(s.subject || 'PAINTING', { bold: false }),
  ];

  if (withMarks) {
    const mCells = [
      s.practical_paper1, s.practical_paper2, s.practical_fabric,
      s.ia_composition, s.ia_illustration, s.ia_still_life,
      s.ia_press_layout, s.ia_landscape, s.ia_book_cover,
      s.ia_lettering, s.ia_sketch, s.ia_poster_design,
      s.ia_total,
      s.oral, s.theory_paper1, s.theory_paper2,
    ].map(v => c(v ?? '', { bold: false, size: 16 }));

    return new TableRow({ children: [
      ...baseCells,
      ...mCells,
      c(s.total_marks ?? '',  { bold: true }),
      c(s.division ?? '',     { bold: false }),
      c(s.distinction ?? '',  { bold: false }),
      c(s.certificate_no ?? '', { bold: false, size: 14 }),
    ]});
  }

  return new TableRow({ children: [...baseCells, c('', {}), c('', {})] });
}

// ── sort helper: numeric roll_no first, lexicographic fallback ────────────────
function sortByRoll(students) {
  return [...students].sort((a, b) => {
    const an = parseInt(a.roll_no, 10);
    const bn = parseInt(b.roll_no, 10);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    return String(a.roll_no).localeCompare(String(b.roll_no));
  });
}

// ── document builder ─────────────────────────────────────────────────────────
function buildDoc(students, center, withMarks) {
  // Sort by roll number regardless of how they were passed in
  const sorted = sortByRoll(students);

  // Extract session from first student (all in a batch share the same session)
  const session = sorted[0]?.session || '';

  const { baseRow1Cells, row2, row3Cells } = buildHeaderRows(withMarks);

  const tableRows = [
    new TableRow({ children: baseRow1Cells }),
    ...(withMarks && row2        ? [row2] : []),
    ...(withMarks && row3Cells.length ? [new TableRow({ children: row3Cells })] : []),
    ...sorted.map((s, i) => studentDataRow(s, i, withMarks)),
  ];

  // ── header paragraphs ──────────────────────────────────────────────────────

  // 1. Center Code  +  Session  — Arial Black, 12 pt, RED
  const codeSessionChildren = [];
  if (center?.code) {
    codeSessionChildren.push(
      redLabel('CENTER CODE : '),
      redLabel(center.code),
      new TextRun({ text: '          ', size: 24 }), // spacer
    );
  }
  if (session) {
    codeSessionChildren.push(
      redLabel('SESSION : '),
      redLabel(session),
    );
  }

  const headerChildren = [];

  if (codeSessionChildren.length) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 100 },
        children: codeSessionChildren,
      })
    );
  }

  // 2. Centre info — Calibri, 10 pt, left-aligned
  headerChildren.push(infoPara('TO', { bold: true, after: 40 }));
  if (center?.incharge_name) headerChildren.push(infoPara(center.incharge_name, { after: 40 }));
  if (center?.co_name)       headerChildren.push(infoPara(`C/O  ${center.co_name}`, { after: 40 }));
  if (center?.name)          headerChildren.push(infoPara(center.name, { after: 40 }));
  if (center?.address)       headerChildren.push(infoPara(center.address, { after: 40 }));

  const location = [center?.district, center?.state].filter(Boolean).join(', ');
  if (location)              headerChildren.push(infoPara(location, { after: 160 }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 15840, height: 12240 },
          orientation: PageOrientation.LANDSCAPE,
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children: [
        ...headerChildren,
        new Table({ width: { size: 14400, type: WidthType.DXA }, rows: tableRows }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 300 },
          children: [new TextRun({
            text: `DISTRICT  —  ${center?.district || ''}`,
            bold: true, size: 20, font: 'Calibri'
          })]
        }),
      ]
    }]
  });

  return Packer.toBuffer(doc);
}

async function generateAllocationSheet(students, center) {
  return buildDoc(students, center, false);
}

async function generateResultSheet(students, center) {
  return buildDoc(students, center, true);
}

module.exports = { generateAllocationSheet, generateResultSheet };
