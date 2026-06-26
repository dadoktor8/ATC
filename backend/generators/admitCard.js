const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageOrientation, HeadingLevel
} = require('docx');

const border = { style: BorderStyle.SINGLE, size: 6, color: '1a1a1a' };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const allBorders = { top: border, bottom: border, left: border, right: border };
const noB = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function cell(text, opts = {}) {
  return new TableCell({
    borders: opts.borders || allBorders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text || '-'),
        bold: opts.bold || false,
        size: opts.size || 20,
        font: 'Arial'
      })]
    })]
  });
}

function headerRow(label, value) {
  return new TableRow({ children: [
    cell(label, { bold: true, width: 3000, shading: 'E8E8E8' }),
    cell(value, { width: 5500 })
  ]});
}

function buildAdmitCard(student) {
  const titlePara = (text, size, bold = true) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, bold, size, font: 'Arial' })]
  });

  return [
    titlePara('ASSAM TALENT COUNCIL (ATC)', 28, true),
    titlePara('ADMIT CARD', 32, true),
    titlePara(student.exam_date ? `Examination: ${student.exam_date}` : 'Annual Examination', 22, false),
    new Paragraph({ text: '', spacing: { before: 120 } }),
    new Table({
      width: { size: 8500, type: WidthType.DXA },
      rows: [
        headerRow('Roll Number', student.roll_no),
        headerRow('Name of Examinee', student.name),
        headerRow('Father\'s Name', student.father_name || '-'),
        headerRow('Mother\'s Name', student.mother_name || '-'),
        headerRow('Date of Birth', student.dob || '-'),
        headerRow('Year / Class', student.year),
        headerRow('Subject', student.subject || 'PAINTING'),
        headerRow('Centre', student.center_name || '-'),
        headerRow('District', student.district || '-'),
        headerRow('Exam Venue', student.exam_venue || '-'),
        headerRow('Exam Date & Time', `${student.exam_date || '-'}  |  ${student.exam_time || '-'}`)
      ]
    }),
    new Paragraph({ text: '', spacing: { before: 200 } }),
    new Table({
      width: { size: 8500, type: WidthType.DXA },
      rows: [new TableRow({ children: [
        cell('', { borders: noB, width: 4000 }),
        cell('Signature of Incharge', { borders: noB, width: 4500, align: AlignmentType.RIGHT, bold: true })
      ]})]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new TextRun({ text: '─────────────────────────────────────────', color: 'AAAAAA', size: 16, font: 'Arial' })]
    })
  ];
}

async function generateAdmitCard(studentOrStudents, bulk = false) {
  const students = bulk ? studentOrStudents : [studentOrStudents];

  const children = [];
  students.forEach((s, i) => {
    children.push(...buildAdmitCard(s));
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateAdmitCard };
