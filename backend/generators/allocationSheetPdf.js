const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const IMAGES_DIR    = path.join(__dirname, '../cert-templates/images');
const TEMPLATES_DIR = path.join(__dirname, '../cert-templates');
const COORDS_FILE   = path.join(TEMPLATES_DIR, 'allocation_sheet_coords.json');

// Windows system fonts
const FONT_ARIAL_BLACK  = 'C:\\Windows\\Fonts\\ariblk.ttf';
const FONT_ARIAL_BOLD   = 'C:\\Windows\\Fonts\\arialbd.ttf';
const FONT_CALIBRI_BOLD = 'C:\\Windows\\Fonts\\calibrib.ttf';
const FONT_CALIBRI      = 'C:\\Windows\\Fonts\\calibri.ttf';
const FONT_HELVETICA    = 'Helvetica'; // PDFKit built-in fallback

function fontExists(p) { return fs.existsSync(p); }

// ── Year abbreviations ────────────────────────────────────────────────────────
const YEAR_ABBR = {
  'Pre-preparatory 1st':  'P.P. I',
  'Pre-preparatory 2nd':  'P.P. II',
  'Pre-preparatory 3rd':  'P.P. III',
  'Beginner Class - I':   'B.C. I',
  'Beginner Class - II':  'B.C. II',
  'Beginner Class - III': 'B.C. III',
  'First Year':           'FIRST',
  'Second Year':          'SECOND',
  'Third Year':           'THIRD',
  'Fourth Year':          'FOURTH',
  'Fifth Year':           'FIFTH',
  'Sixth Year':           'SIXTH',
  'Seventh Year':         'SEVENTH',
};

// ── Subject abbreviations ─────────────────────────────────────────────────────
const SUBJECT_ABBR = {
  'Painting':           'Painting',
  'Applied Art':        'Applied Art',
  'Graphic':            'Graphic',
  'Sculpture':          'Sculpture',
  'Fabric Painting':    'Fabric Painting',
  'Vocal Music':        'Vocal Music',
  'Tabla Badya':        'Tabla Badya',
  'Monipuri Nritya':    'Monipuri Nritya',
  'Kathak Nritya':      'Kathak Nritya',
  'Guitar (Classical)': 'Guitar (Classical)',
  'Violin':             'Violin',
};

function abbr(map, value) {
  if (!value) return '';
  return map[value] || map[value.trim()] || value;
}

// Whether a student row is fully absent (all individual marks are null)
const isAbsent = s => s.division === 'AB';

// Maps editor col_ keys → function that extracts the value from a student row.
// For absent students: individual mark cells show 'AB', totals/division handled separately.
const COL_MARKS_MAP = [
  { key: 'col_prac1',        val: s => isAbsent(s) ? 'AB' : s.practical_paper1 },
  { key: 'col_prac2',        val: s => isAbsent(s) ? 'AB' : s.practical_paper2 },
  { key: 'col_fabric',       val: s => isAbsent(s) ? 'AB' : s.practical_fabric },
  { key: 'col_composition',  val: s => isAbsent(s) ? null : s.ia_composition },
  { key: 'col_illustration', val: s => isAbsent(s) ? null : s.ia_illustration },
  { key: 'col_still_life',   val: s => isAbsent(s) ? null : s.ia_still_life },
  { key: 'col_press_layout', val: s => isAbsent(s) ? null : s.ia_press_layout },
  { key: 'col_landscape',    val: s => isAbsent(s) ? null : s.ia_landscape },
  { key: 'col_book_cover',   val: s => isAbsent(s) ? null : s.ia_book_cover },
  { key: 'col_lettering',    val: s => isAbsent(s) ? null : s.ia_lettering },
  { key: 'col_sketch',       val: s => isAbsent(s) ? null : s.ia_sketch },
  { key: 'col_poster_design',val: s => isAbsent(s) ? null : s.ia_poster_design },
  { key: 'col_ia_total',     val: s => isAbsent(s) ? null : s.ia_total },
  { key: 'col_oral',         val: s => isAbsent(s) ? 'AB' : s.oral },
  { key: 'col_theory1',      val: s => isAbsent(s) ? 'AB' : s.theory_paper1 },
  { key: 'col_theory2',      val: s => isAbsent(s) ? 'AB' : s.theory_paper2 },
  { key: 'col_total',        val: s => isAbsent(s) ? 'AB' : s.total_marks },
  { key: 'col_division',     val: s => s.division === 'AB' ? 'ABSENT' : s.division },
  { key: 'col_distinction',  val: s => s.distinction },
  { key: 'col_cert_no',      val: s => s.certificate_no },
];

const HDR_WIDTHS = {
  header_session:  180,
  header_centre_no: 100,
};

// ── Year sort order ───────────────────────────────────────────────────────────
const YEAR_ORDER = Object.keys(YEAR_ABBR);

function yearSortKey(year) {
  const idx = YEAR_ORDER.findIndex(
    y => y.toLowerCase() === (year || '').trim().toLowerCase()
  );
  return idx === -1 ? 99 : idx;
}

function sortStudents(students) {
  return [...students].sort((a, b) =>
    String(a.roll_no).localeCompare(String(b.roll_no), undefined, { numeric: true })
  );
}

function findImage(name = 'allocation_sheet') {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const p = path.join(IMAGES_DIR, `${name}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findSignature() {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const p = path.join(IMAGES_DIR, `signature.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function fitText(doc, text, maxWidth) {
  if (!text) return '';
  let t = String(text);
  if (doc.widthOfString(t) <= maxWidth) return t;
  while (t.length > 1 && doc.widthOfString(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

async function generateAllocationSheetPdf(students, center, session, opts = {}) {
  const coordsFile = opts.coordsFile
    ? path.join(TEMPLATES_DIR, opts.coordsFile)
    : COORDS_FILE;
  const coords  = JSON.parse(fs.readFileSync(coordsFile, 'utf8'));
  const imagePath    = findImage(opts.imageName || 'allocation_sheet');
  const signaturePath = findSignature();
  const mapW    = coords.image_size.w;
  const mapH    = coords.image_size.h;
  const maxRows = coords.max_rows   || 25;
  const rowH    = coords.row_height || 16;
  const f       = coords.fields;

  const useArialBlack  = fontExists(FONT_ARIAL_BLACK);
  const useArialBold   = fontExists(FONT_ARIAL_BOLD);
  const useCalibri     = fontExists(FONT_CALIBRI);
  const useCalibriB    = fontExists(FONT_CALIBRI_BOLD);

  // Compute widths for ALL col_ fields from consecutive x-position gaps.
  // Marks cols capped at 80px (prevents cert_no stretching to page edge).
  // Base cols (name etc.) uncapped so left-aligned text has full room.
  const colWidths = (() => {
    const MARKS_KEYS = new Set(COL_MARKS_MAP.map(m => m.key));
    const allKeys = [
      'col_sl_no', 'col_roll_no', 'col_name', 'col_year', 'col_subject',
      ...COL_MARKS_MAP.map(m => m.key),
    ];
    const present = allKeys
      .filter(k => f[k] && f[k].x != null)
      .map(k => ({ key: k, x: f[k].x }))
      .sort((a, b) => a.x - b.x);
    const widths = {};
    present.forEach((col, i) => {
      const nextX = i < present.length - 1 ? present[i + 1].x : mapW;
      const gap = Math.max(nextX - col.x - 1, 18);
      widths[col.key] = MARKS_KEYS.has(col.key) ? Math.min(gap, 80) : gap;
    });
    return widths;
  })();

  const sorted = sortStudents(students);
  const pages  = [];
  for (let i = 0; i < sorted.length; i += maxRows) pages.push(sorted.slice(i, i + maxRows));
  if (pages.length === 0) pages.push([]);

  const sessionLabel = session || '';

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: [mapW, mapH], margin: 0, autoFirstPage: false });
    doc.on('data', b => chunks.push(b));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Draw text left-aligned, fitted to maxWidth, baseline-adjusted, always uppercase
    const draw = (x, y, text, fontSize, maxWidth) => {
      if (text == null || text === '') return;
      doc.fontSize(fontSize || 9);
      const upper  = String(text).toUpperCase();
      const fitted = maxWidth ? fitText(doc, upper, maxWidth) : upper;
      doc.text(fitted, x, y - (fontSize || 9), { lineBreak: false });
    };

    // Draw text centered AT x (pin = column centre), baseline-adjusted, always uppercase
    const drawCenter = (cx, y, text, fontSize, _colWidth) => {
      if (text == null || text === '') return;
      doc.fontSize(fontSize || 9);
      const upper = String(text).toUpperCase();
      const tw    = doc.widthOfString(upper);
      doc.text(upper, cx - tw / 2, y - (fontSize || 9), { lineBreak: false });
    };

    pages.forEach((chunk, pageIdx) => {
      doc.addPage({ size: [mapW, mapH], margin: 0 });

      // ── Background ─────────────────────────────────────────────
      if (imagePath) {
        doc.image(imagePath, 0, 0, { width: mapW, height: mapH });
      } else {
        doc.rect(0, 0, mapW, mapH).fill('#ffffff');
        doc.rect(0, 0, mapW - 1, mapH - 1).stroke('#cc0000');
        doc.font(FONT_HELVETICA).fontSize(8).fillColor('#cc0000')
           .text('⚠ Upload allocation_sheet image in Documents', 20, 8, { lineBreak: false });
      }

      // ── Session & Centre No — Arial Black, 12pt, red ───────────
      const arialBlack = useArialBlack ? FONT_ARIAL_BLACK : FONT_HELVETICA;
      doc.font(arialBlack).fillColor('red');
      draw(f.header_session.x,   f.header_session.y,   sessionLabel,       12, HDR_WIDTHS.header_session);
      const centreNoLabel = center?.code ? `C/${center.code}` : '';
      draw(f.header_centre_no.x, f.header_centre_no.y, centreNoLabel, 12, HDR_WIDTHS.header_centre_no);

      // ── Top-left header — Calibri Bold, 10pt, black ────────────
      // Layout (dynamic — C/O line is optional):
      //   Line 1: Teacher name
      //   Line 2: C/O – [co_name]          ← only if co_name is set
      //   Line 3: [centre name], [address]  ← combined on one line
      //   Line 4: DISTRICT – [district] ([state])
      const calibri = useCalibriB ? FONT_CALIBRI_BOLD : (useCalibri ? FONT_CALIBRI : FONT_HELVETICA);
      doc.font(calibri).fillColor('black');

      const hdrX    = f.header_x          ?? 29;
      const startY  = f.header_start_y    ?? 26;
      const lineH   = f.header_line_height ?? 13;
      const hdrMaxW = f.header_max_width  ?? 280;
      const hasCo   = !!(center?.co_name && String(center.co_name).trim());

      let lineY = startY;

      // Line 1 — "TO"
      draw(hdrX, lineY, 'TO', 10, hdrMaxW);
      lineY += lineH;

      // Line 2 — teacher name
      draw(hdrX, lineY, center?.incharge_name || '', 10, hdrMaxW);
      lineY += lineH;

      // Line 2 — C/O (conditional)
      if (hasCo) {
        draw(hdrX, lineY, `C/O - ${center.co_name}`, 10, hdrMaxW);
        lineY += lineH;
      }

      // Line 3 — centre name + address combined
      const nameAddr = [center?.name, center?.address]
        .map(s => (s || '').trim()).filter(Boolean).join(', ');
      draw(hdrX, lineY, nameAddr, 10, hdrMaxW);
      lineY += lineH;

      // Line 4 — DISTRICT – [district] ([state])
      const district  = (center?.district || '').trim();
      const state     = (center?.state    || 'ASSAM').trim();
      const distState = `DISTRICT - ${district} (${state})`;
      draw(hdrX, lineY, distState, 10, hdrMaxW);

      // ── Student rows ────────────────────────────────────────────
      // Use Arial Bold throughout for heavy, consistent look matching the reference.
      // Falls back to Calibri Bold then Helvetica if Arial Bold is unavailable.
      const rowFont = useArialBold ? FONT_ARIAL_BOLD
                    : useCalibriB  ? FONT_CALIBRI_BOLD
                    : useCalibri   ? FONT_CALIBRI
                    : FONT_HELVETICA;

      doc.fillColor('black');
      chunk.forEach((s, rowIdx) => {
        const globalIdx = pageIdx * maxRows + rowIdx;
        const rowY      = f.row_first_y.y + rowIdx * rowH;
        const serial    = String(globalIdx + 1).padStart(2, '0') + '.';
        const yearText  = abbr(YEAR_ABBR,    s.year);
        const subjText  = abbr(SUBJECT_ABBR, s.subject || 'Painting');

        doc.font(rowFont);

        // SL.No — centered
        drawCenter(f.col_sl_no.x,   rowY, serial,    9, colWidths['col_sl_no']   || 35);

        // Roll No — centered
        drawCenter(f.col_roll_no.x, rowY, s.roll_no, f.col_roll_no.fontSize || 9, colWidths['col_roll_no'] || 67);

        // Name — left-aligned with fitText truncation
        draw(f.col_name.x,    rowY, s.name,    9, colWidths['col_name']    || 158);

        // Year — centered
        drawCenter(f.col_year.x,    rowY, yearText,  9, colWidths['col_year']    || 48);

        // Subject — centered
        drawCenter(f.col_subject.x, rowY, subjText,  9, colWidths['col_subject'] || 48);

        // ── Optional marks columns (drawn only if positioned in coords JSON) ──
        COL_MARKS_MAP.forEach(({ key, val }) => {
          const colCoord = f[key];
          if (!colCoord) return;           // not positioned in editor → skip
          const raw = val(s);
          if (raw == null) return;         // no data → leave cell blank
          const fontSize = colCoord.fontSize || 9;
          const colWidth = colCoord.w || colWidths[key] || 22;
          drawCenter(colCoord.x, rowY, String(raw), fontSize, colWidth);
        });
      });

      // ── Footer: signature image + page number (always "1") ──────
      if (signaturePath && f.footer_signature) {
        const sig = f.footer_signature;
        doc.image(signaturePath, sig.x, sig.y, { width: sig.w || 100, height: sig.h || 35 });
      }

      if (f.footer_page_no) {
        const pn = f.footer_page_no;
        const arialBold = useArialBold ? FONT_ARIAL_BOLD : FONT_HELVETICA;
        doc.font(arialBold).fillColor('black');
        draw(pn.x, pn.y, '1', pn.fontSize || 10);
      }
    });

    doc.end();
  });
}

module.exports = { generateAllocationSheetPdf };
