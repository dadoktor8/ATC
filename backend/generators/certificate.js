const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { Jimp, loadFont } = require('jimp');

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

function loadCoords(certType) {
  const fname = COORD_FILES[certType];
  if (!fname) throw new Error(`Unknown cert type: ${certType}`);
  const p = path.join(TEMPLATES_DIR, fname);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Build field values from student + marks data
function buildFieldValues(student, certType) {
  const today = new Date();
  const dateStr = student.exam_date ||
    `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

  if (certType === 'admit_card') {
    return {
      roll_no:  student.roll_no  || '',
      name:     student.name     || '',
      parent:   student.father_name || '',
      year:     student.year     || '',
      subject:  student.subject  || 'Painting',
      centre:   student.center_name || '',
      district: student.district || '',
      state:    'ASSAM',
      session:  student.session  || `${today.getFullYear()}-${String(today.getFullYear()+1).slice(-2)}`,
    };
  }

  return {
    serial_no:   student.certificate_no || '',
    roll_no:     student.roll_no  || '',
    name:        student.name     || '',
    parent:      student.father_name || '',
    centre:      student.center_name || '',
    centre_of:   student.center_address || '',
    year:        student.year     || '',
    exam_year:   student.exam_year || String(today.getFullYear()),
    division:    student.division || '',
    distinction: student.distinction || '',
    subject:     student.subject  || 'Painting',
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
    const image = await Jimp.read(imagePath);
    const imgW = image.bitmap.width;
    const imgH = image.bitmap.height;

    // Scale coords if image size differs from what was mapped
    const mapW = coords.image_size.w;
    const mapH = coords.image_size.h;
    const scaleX = imgW / mapW;
    const scaleY = imgH / mapH;

    // We'll use PDFKit to composite — jimp can't render nice fonts easily.
    // Strategy: embed the background image, then draw text on top with PDFKit.
    const pdfBuf = await new Promise((resolve, reject) => {
      const chunks = [];
      // Landscape A4 ≈ certificate proportions
      const PAGE_W = imgW;
      const PAGE_H = imgH;

      const doc = new PDFDocument({
        size: [PAGE_W, PAGE_H],
        margin: 0,
        autoFirstPage: true,
      });

      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Background image
      doc.image(imagePath, 0, 0, { width: PAGE_W, height: PAGE_H });

      // Draw each field
      doc.font('Helvetica').fillColor('black');

      Object.entries(coords.fields).forEach(([key, cfg]) => {
        const value = fieldValues[key];
        if (!value) return;

        const x = cfg.x * scaleX;
        const y = (cfg.y * scaleY) - (cfg.fontSize || 13); // baseline adjust

        doc.fontSize(cfg.fontSize || 13)
           .text(value, x, y, { lineBreak: false });
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

  const firstStudent = students[0];
  const imgRef = imagePath ? await Jimp.read(imagePath) : null;
  const imgW = imgRef ? imgRef.bitmap.width : 842;
  const imgH = imgRef ? imgRef.bitmap.height : 595;
  const mapW = coords.image_size.w;
  const mapH = coords.image_size.h;
  const scaleX = imgW / mapW;
  const scaleY = imgH / mapH;

  const pdfBuf = await new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: [imgW, imgH],
      margin: 0,
      autoFirstPage: false,
    });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    students.forEach((student) => {
      doc.addPage({ size: [imgW, imgH], margin: 0 });

      if (imagePath) {
        doc.image(imagePath, 0, 0, { width: imgW, height: imgH });
      } else {
        doc.rect(0,0,imgW,imgH).fill('#fffde7');
        doc.fillColor('black').fontSize(16).font('Helvetica-Bold')
           .text('ART TRAINING CENTRE — ' + certType.toUpperCase(), 40, 40);
      }

      const fieldValues = buildFieldValues(student, certType);
      doc.font('Helvetica').fillColor('black');

      Object.entries(coords.fields).forEach(([key, cfg]) => {
        const value = fieldValues[key];
        if (!value) return;
        const x = cfg.x * scaleX;
        const y = (cfg.y * scaleY) - (cfg.fontSize || 13);
        doc.fontSize(cfg.fontSize || 13)
           .text(value, x, y, { lineBreak: false });
      });
    });

    doc.end();
  });

  return pdfBuf;
}

module.exports = { generateCertificate, generateCertificateBulk, COORD_FILES, IMAGE_FILES, IMAGES_DIR };
