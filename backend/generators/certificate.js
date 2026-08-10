const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const FONT_ARIAL      = 'C:\\Windows\\Fonts\\arial.ttf';
const FONT_ARIAL_BOLD = 'C:\\Windows\\Fonts\\arialbd.ttf';
const FONT_CORSIVA       = 'C:\\Windows\\Fonts\\MTCORSVA.TTF';
const FONT_TNR_ITALIC    = 'C:\\Windows\\Fonts\\timesi.ttf';
const FONT_TNR_BOLD_ITALIC = fs.existsSync('C:\\Windows\\Fonts\\timesbi.ttf')
  ? 'C:\\Windows\\Fonts\\timesbi.ttf'
  : 'C:\\Windows\\Fonts\\timesi.ttf';
const FONT_TNR_BOLD = fs.existsSync('C:\\Windows\\Fonts\\timesbd.ttf')
  ? 'C:\\Windows\\Fonts\\timesbd.ttf'
  : 'C:\\Windows\\Fonts\\times.ttf';
const FONT_VIVACE     = path.join(__dirname, '../cert-templates/fonts/English111VivaceBT.ttf');

function resolveFont(bold = false) {
  return bold ? FONT_ARIAL_BOLD : FONT_ARIAL;
}

// Per-field font overrides. pt = desired PDF point size (not scaled by sx).
// If a font path is null the field falls back to default Arial Bold.
const FIELD_FONTS = {
  serial_no:  { path: FONT_CORSIVA,    pt: 14 },
  roll_no:    { path: FONT_CORSIVA,    pt: 18 },
  name:       { path: FONT_VIVACE,     pt: 24 },
  parent:     { path: FONT_VIVACE,     pt: 24 },
  centre:     { path: FONT_VIVACE,     pt: 24 },
  centre_of:  { path: FONT_VIVACE,     pt: 24 },
  year:       { path: FONT_VIVACE, pt: 24 },
  exam_year:  { path: FONT_VIVACE,     pt: 24 },
  division:    { path: FONT_VIVACE, pt: 24 },
  distinction: { path: FONT_CORSIVA, pt: 24 },
  subject:     { path: FONT_VIVACE, pt: 24 },
  date:       { path: FONT_TNR_BOLD_ITALIC, pt: 14 },
};

const TEMPLATES_DIR = path.join(__dirname, '../cert-templates');
const IMAGES_DIR = path.join(__dirname, '../cert-templates/images');

// Map cert_type → coord file
const COORD_FILES = {
  senior_diploma_final: 'senior_diploma_final_coords.json',
  junior_diploma:       'junior_diploma_coords.json',
  ankan_visharad:       'ankan_visharad_coords.json',
  junior_diploma_final: 'junior_diploma_final_coords.json',
  ankan_ratna:          'ankan_ratna_coords.json',
  admit_card:           'admit_card_coords.json',
};

// Map cert_type → image filename (user drops PNGs/JPEGs here)
const IMAGE_FILES = {
  senior_diploma_final: ['senior_diploma_final.jpg', 'senior_diploma_final.jpeg', 'senior_diploma_final.png'],
  junior_diploma:       ['junior_diploma.jpg', 'junior_diploma.jpeg', 'junior_diploma.png'],
  ankan_visharad:       ['ankan_visharad.jpg', 'ankan_visharad.jpeg', 'ankan_visharad.png'],
  junior_diploma_final: ['junior_diploma_final.jpg', 'junior_diploma_final.jpeg', 'junior_diploma_final.png'],
  ankan_ratna:          ['ankan_ratna.jpg', 'ankan_ratna.jpeg', 'ankan_ratna.png'],
  admit_card:           ['admit_card.jpg', 'admit_card.jpeg', 'admit_card.png'],
  allocation_sheet:     ['allocation_sheet.jpg', 'allocation_sheet.jpeg', 'allocation_sheet.png'],
  mark_sheet:           ['mark_sheet.jpg', 'mark_sheet.jpeg', 'mark_sheet.png'],
  result_sheet:         ['result_sheet.jpg', 'result_sheet.jpeg', 'result_sheet.png'],
};

function findImage(certType) {
  const candidates = IMAGE_FILES[certType] || [];
  for (const fname of candidates) {
    const p = path.join(IMAGES_DIR, fname);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findSignatureImage(fieldKey) {
  const fallbacks = {
    footer_signature:      'signature',
    president_signature:   'co_signature',
    kendrakshya_signature: 'signature',
  };
  const names = [fieldKey, fallbacks[fieldKey] || null].filter(Boolean);
  for (const name of names) {
    for (const ext of ['jpg', 'jpeg', 'png']) {
      const p = path.join(IMAGES_DIR, `${name}.${ext}`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function loadCoords(certType) {
  const fname = COORD_FILES[certType];
  if (!fname) throw new Error(`Unknown cert type: ${certType}`);
  const p = path.join(TEMPLATES_DIR, fname);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const YEAR_ABBR = {
  'Pre-preparatory 1st':  'P.P. - 1st',
  'Pre-preparatory 2nd':  'P.P. - 2nd',
  'Pre-preparatory 3rd':  'P.P. - 3rd',
  'Beginner Class - I':   'B.C. - I',
  'Beginner Class - II':  'B.C. - II',
  'Beginner Class - III': 'B.C. - III',
  'First Year':           'First Year',
  'Second Year':          'Second Year',
  'Third Year':           'Third',
  'Fourth Year':          'Fourth Year',
  'Fifth Year':           'Fifth',
  'Sixth Year':           'Sixth Year',
  'Seventh Year':         'Seventh',
};

function toTitleCase(str) {
  if (!str) return '';
  return str.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Build field values from student + marks data
function buildFieldValues(student, certType) {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
  const dateStr = student.marksheet_date || todayStr;

  if (certType === 'admit_card') {
    return {
      roll_no:   student.roll_no  || '',
      name:      student.name     || '',
      parent:    student.father_name || '',
      year:      YEAR_ABBR[student.year] || student.year || '',
      subject:   student.subject  || 'Painting',
      centre:    student.center_name || '',
      district:  student.district || '',
      state:     'ASSAM',
      session:   student.session  || `${today.getFullYear()}-${String(today.getFullYear()+1).slice(-2)}`,
    };
  }

  return {
    serial_no:   student.certificate_no || '',
    roll_no:     student.roll_no  || '',
    name:        toTitleCase(student.name),
    parent:      toTitleCase(student.father_name),
    centre:      toTitleCase(student.center_name),
    centre_of:   [student.center_address, student.district, student.center_state]
                   .map(s => toTitleCase((s || '').trim())).filter(Boolean).join(', '),
    year:        YEAR_ABBR[student.year] || student.year || '',
    exam_year:   student.session || student.exam_year || String(today.getFullYear()),
    division:    toTitleCase(student.division),
    distinction: toTitleCase(student.distinction),
    subject:     toTitleCase(student.subject || 'Painting'),
    date:        dateStr,
  };
}

/**
 * Generate a single certificate PDF buffer.
 * Returns a Buffer containing the PDF.
 */
async function generateCertificate(student, certType) {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const coords = loadCoords(certType);
  const imagePath = findImage(certType);
  const fieldValues = buildFieldValues(student, certType);

  // === PATH A: Image found → composite text onto image, embed in PDF ===
  if (imagePath) {
    const mapW = coords.image_size.w;
    const mapH = coords.image_size.h;

    // Admit cards have a fixed form size — use coord space 1:1.
    // All other cert types normalise to A4 landscape so high-res coord maps
    // still produce readable font sizes regardless of the source image resolution.
    const PAGE_W = certType === 'admit_card' ? mapW : 842;
    const PAGE_H = certType === 'admit_card' ? mapH : Math.round(842 * mapH / mapW);
    const sx = PAGE_W / mapW;
    const sy = PAGE_H / mapH;

    const pdfBuf = await new Promise((resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, autoFirstPage: true });
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.image(imagePath, 0, 0, { width: PAGE_W, height: PAGE_H });

      doc.fillColor('black');

      Object.entries(coords.fields).forEach(([key, cfg]) => {
        if (key.endsWith('_signature')) return;
        const value = fieldValues[key];
        if (!value) return;
        const override = certType !== 'admit_card' ? FIELD_FONTS[key] : null;
        if (override && override.path) {
          const pt = override.pt;
          const x = cfg.x * sx, y = cfg.y * sy - pt;
          // Year field: split "B.C. - III" → prefix in Vivace, Roman numeral in TNR Bold Italic
          const romanMatch = key === 'year' && value.match(/^(.+?)\s*-\s*([IVX]+)$/i);
          if (romanMatch) {
            const prefix = romanMatch[1].trim() + ' - ';
            const roman  = romanMatch[2];
            doc.font(FONT_VIVACE).fontSize(pt).fillColor('black').strokeColor('black').lineWidth(1.5);
            doc._textMode = 2;
            const pw = doc.widthOfString(prefix);
            doc.text(prefix, x, y, { lineBreak: false });
            doc.text(prefix, x, y, { lineBreak: false });
            doc.font(FONT_TNR_ITALIC).fontSize(pt - 3).lineWidth(0.4);
            doc.text(roman, x + pw, y + 5, { lineBreak: false });
            doc.text(roman, x + pw, y + 5, { lineBreak: false });
            doc._textMode = 0;
          } else {
            doc.font(override.path).fontSize(pt).fillColor('black').strokeColor('black').lineWidth(1.5);
            doc._textMode = 2;
            doc.text(value, x, y, { lineBreak: false });
            doc.text(value, x, y, { lineBreak: false });
            doc._textMode = 0;
          }
        } else {
          const fs = (cfg.fontSize || 13) * sx;
          doc.font(resolveFont(true)).fontSize(fs)
             .text(value, cfg.x * sx, cfg.y * sy - fs, { lineBreak: false });
        }
      });

      // Render all signature image fields (footer_signature, president_signature, etc.)
      Object.entries(coords.fields).forEach(([key, cfg]) => {
        if (!key.endsWith('_signature')) return;
        const sigPath = findSignatureImage(key);
        if (!sigPath) return;
        doc.image(sigPath, cfg.x * sx, cfg.y * sy, {
          width: (cfg.w || 100) * sx, height: (cfg.h || 35) * sy,
        });
      });

      doc.end();
    });

    return pdfBuf;
  }

  // === PATH B: No image → generate text-only placeholder PDF ===
  const pdfBuf = await new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold')
       .text('ART TRAINING CENTRE', { align: 'center' });
    doc.fontSize(14).font('Helvetica')
       .text(`Certificate Type: ${certType.replace(/_/g,' ').toUpperCase()}`, { align: 'center' });
    doc.moveDown(2);

    // ⚠️ Warning box
    doc.fontSize(11).fillColor('red')
       .text(`⚠ Template image not found.`, { align: 'center' })
       .text(`Place the image at:`, { align: 'center' })
       .text(`backend/cert-templates/images/${IMAGE_FILES[certType]?.[0] || certType+'.jpg'}`, { align: 'center' });
    doc.moveDown(2);

    doc.fillColor('black').fontSize(12);
    Object.entries(fieldValues).forEach(([k, v]) => {
      if (v) doc.text(`${k.replace(/_/g,' ')}: ${v}`);
    });

    doc.end();
  });

  return pdfBuf;
}

/**
 * Generate certificates for multiple students, one per page.
 */
async function generateCertificateBulk(students, certType) {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  if (students.length === 0) throw new Error('No students found');

  const coords = loadCoords(certType);
  const imagePath = findImage(certType);
  const mapW = coords.image_size.w;
  const mapH = coords.image_size.h;
  const PAGE_W = certType === 'admit_card' ? mapW : 842;
  const PAGE_H = certType === 'admit_card' ? mapH : Math.round(842 * mapH / mapW);
  const sx = PAGE_W / mapW;
  const sy = PAGE_H / mapH;

  const pdfBuf = await new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, autoFirstPage: false });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    students.forEach((student) => {
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });

      if (imagePath) {
        doc.image(imagePath, 0, 0, { width: PAGE_W, height: PAGE_H });
      } else {
        doc.rect(0, 0, PAGE_W, PAGE_H).fill('#fffde7');
        doc.fillColor('black').fontSize(16).font(resolveFont(true))
           .text('ART TRAINING CENTRE — ' + certType.toUpperCase(), 40, 40);
      }

      const fieldValues = buildFieldValues(student, certType);
      doc.fillColor('black');

      Object.entries(coords.fields).forEach(([key, cfg]) => {
        if (key.endsWith('_signature')) return;
        const value = fieldValues[key];
        if (!value) return;
        const override = certType !== 'admit_card' ? FIELD_FONTS[key] : null;
        if (override && override.path) {
          const pt = override.pt;
          const x = cfg.x * sx, y = cfg.y * sy - pt;
          // Year field: split "B.C. - III" → prefix in Vivace, Roman numeral in TNR Bold Italic
          const romanMatch = key === 'year' && value.match(/^(.+?)\s*-\s*([IVX]+)$/i);
          if (romanMatch) {
            const prefix = romanMatch[1].trim() + ' - ';
            const roman  = romanMatch[2];
            doc.font(FONT_VIVACE).fontSize(pt).fillColor('black').strokeColor('black').lineWidth(1.5);
            doc._textMode = 2;
            const pw = doc.widthOfString(prefix);
            doc.text(prefix, x, y, { lineBreak: false });
            doc.text(prefix, x, y, { lineBreak: false });
            doc.font(FONT_TNR_ITALIC).fontSize(pt - 3).lineWidth(0.4);
            doc.text(roman, x + pw, y + 5, { lineBreak: false });
            doc.text(roman, x + pw, y + 5, { lineBreak: false });
            doc._textMode = 0;
          } else {
            doc.font(override.path).fontSize(pt).fillColor('black').strokeColor('black').lineWidth(1.5);
            doc._textMode = 2;
            doc.text(value, x, y, { lineBreak: false });
            doc.text(value, x, y, { lineBreak: false });
            doc._textMode = 0;
          }
        } else {
          const fs = (cfg.fontSize || 13) * sx;
          doc.font(resolveFont(true)).fontSize(fs)
             .text(value, cfg.x * sx, cfg.y * sy - fs, { lineBreak: false });
        }
      });

      // Render all signature image fields
      Object.entries(coords.fields).forEach(([key, cfg]) => {
        if (!key.endsWith('_signature')) return;
        const sigPath = findSignatureImage(key);
        if (!sigPath) return;
        doc.image(sigPath, cfg.x * sx, cfg.y * sy, {
          width: (cfg.w || 100) * sx, height: (cfg.h || 35) * sy,
        });
      });
    });

    doc.end();
  });

  return pdfBuf;
}

module.exports = { generateCertificate, generateCertificateBulk, COORD_FILES, IMAGE_FILES, IMAGES_DIR };
