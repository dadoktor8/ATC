const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const IMAGES_DIR    = path.join(__dirname, '../cert-templates/images');
const TEMPLATES_DIR = path.join(__dirname, '../cert-templates');
const COORDS_FILE   = path.join(TEMPLATES_DIR, 'mark_sheet_coords.json');

const FONT_ARIAL_BOLD   = 'C:\\Windows\\Fonts\\arialbd.ttf';
const FONT_CALIBRI_BOLD = 'C:\\Windows\\Fonts\\calibrib.ttf';
const FONT_CALIBRI      = 'C:\\Windows\\Fonts\\calibri.ttf';
const FONT_HELVETICA    = 'Helvetica';

function fontExists(p) { return fs.existsSync(p); }

function fitText(doc, text, maxWidth) {
  if (!text) return '';
  let t = String(text);
  if (doc.widthOfString(t) <= maxWidth) return t;
  while (t.length > 1 && doc.widthOfString(t + '…') > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

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

function abbr(map, value) {
  if (!value) return '';
  return map[value] || map[value.trim()] || value;
}

function findImage() {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const p = path.join(IMAGES_DIR, `mark_sheet.${ext}`);
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

const COL_MARKS = [
  { key: 'col_prac1',         val: s => s.practical_paper1 },
  { key: 'col_prac2',         val: s => s.practical_paper2 },
  { key: 'col_fabric',        val: s => s.practical_fabric },
  { key: 'col_composition',   val: s => s.ia_composition },
  { key: 'col_illustration',  val: s => s.ia_illustration },
  { key: 'col_still_life',    val: s => s.ia_still_life },
  { key: 'col_press_layout',  val: s => s.ia_press_layout },
  { key: 'col_landscape',     val: s => s.ia_landscape },
  { key: 'col_book_cover',    val: s => s.ia_book_cover },
  { key: 'col_lettering',     val: s => s.ia_lettering },
  { key: 'col_sketch',        val: s => s.ia_sketch },
  { key: 'col_poster_design', val: s => s.ia_poster_design },
  { key: 'col_ia_total',      val: s => s.ia_total },
  { key: 'col_oral',          val: s => s.oral },
  { key: 'col_theory1',       val: s => s.theory_paper1 },
  { key: 'col_theory2',       val: s => s.theory_paper2 },
  { key: 'col_total',         val: s => s.total_marks },
  { key: 'col_division',      val: s => s.division === 'AB' ? 'ABSENT' : s.division },
  { key: 'col_distinction',   val: s => s.distinction },
];

const ABSENT_SHOW_AB  = new Set(['col_prac1','col_prac2','col_fabric','col_oral','col_theory1','col_theory2','col_total']);
const ABSENT_SHOW_TXT = new Set(['col_division']);

async function generateMarkSheetPdf(students, center, session) {
  const studentList = Array.isArray(students) ? students : [students];
  const coords      = JSON.parse(fs.readFileSync(COORDS_FILE, 'utf8'));
  const imagePath   = findImage();
  const signaturePath = findSignature();
  const mapW = coords.image_size.w;
  const mapH = coords.image_size.h;
  const f    = coords.fields;

  const useArialBold = fontExists(FONT_ARIAL_BOLD);
  const useCalibriB  = fontExists(FONT_CALIBRI_BOLD);
  const useCalibri   = fontExists(FONT_CALIBRI);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: [mapW, mapH], margin: 0, autoFirstPage: false });
    doc.on('data', b => chunks.push(b));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const bodyFont = useArialBold ? FONT_ARIAL_BOLD
                   : useCalibriB  ? FONT_CALIBRI_BOLD
                   : useCalibri   ? FONT_CALIBRI
                   : FONT_HELVETICA;

    // Left-aligned text at field coord
    const draw = (field, text, maxWidth) => {
      if (!field || text == null || text === '') return;
      doc.fontSize(field.fontSize || 10);
      const upper  = String(text).toUpperCase();
      const fitted = maxWidth ? fitText(doc, upper, maxWidth) : upper;
      doc.text(fitted, field.x, field.y - (field.fontSize || 10), { lineBreak: false });
    };

    // Centered text at field coord (x = centre of cell)
    const drawCenter = (field, text) => {
      if (!field || text == null || text === '') return;
      doc.fontSize(field.fontSize || 9);
      const upper = String(text).toUpperCase();
      const tw    = doc.widthOfString(upper);
      doc.text(upper, field.x - tw / 2, field.y - (field.fontSize || 9), { lineBreak: false });
    };

    studentList.forEach(s => {
      doc.addPage({ size: [mapW, mapH], margin: 0 });

      if (imagePath) {
        doc.image(imagePath, 0, 0, { width: mapW, height: mapH });
      } else {
        doc.rect(0, 0, mapW, mapH).fill('#ffffff');
        doc.rect(0, 0, mapW - 1, mapH - 1).stroke('#000000');
        doc.font(FONT_HELVETICA).fontSize(8).fillColor('#888')
           .text('⚠ Upload mark_sheet image in Documents', 20, 10, { lineBreak: false });
      }

      doc.font(bodyFont).fillColor('black');

      const resolvedCenter = center || { name: s.center_name };

      // Header text fields
      draw(f.f_student_name, s.name,               f.f_student_name?.maxWidth);
      draw(f.f_center_name,  resolvedCenter?.name,  f.f_center_name?.maxWidth);
      draw(f.f_roll_no,      s.roll_no);
      draw(f.f_subject,      s.subject || 'Painting', f.f_subject?.maxWidth);
      draw(f.f_year,         abbr(YEAR_ABBR, s.year));

      // Session "2026-2027" → last 2 digits of each part
      const sessionStr = s.session || session || '';
      const parts = sessionStr.split('-');
      draw(f.f_session_from, (parts[0] || '').trim().slice(-2));
      draw(f.f_session_to,   (parts[1] || '').trim().slice(-2));

      // Marks obtained row
      const absent = s.division === 'AB';
      COL_MARKS.forEach(({ key, val }) => {
        const coord = f[key];
        if (!coord) return;
        let rawVal;
        if (absent) {
          if (ABSENT_SHOW_AB.has(key))  rawVal = 'AB';
          else if (ABSENT_SHOW_TXT.has(key)) rawVal = 'ABSENT';
          else rawVal = null;
        } else {
          rawVal = val(s);
        }
        if (rawVal == null) return;
        drawCenter(coord, String(rawVal));
      });

      // Signature
      if (signaturePath && f.footer_signature) {
        const sig = f.footer_signature;
        doc.image(signaturePath, sig.x, sig.y, { width: sig.w || 80, height: sig.h || 30 });
      }
    });

    doc.end();
  });
}

module.exports = { generateMarkSheetPdf };
