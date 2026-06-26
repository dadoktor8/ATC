const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign
} = require('docx');

const border = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const allB = { top: border, bottom: border, left: border, right: border };

function c(text, opts = {}) {
  return new TableCell({
    borders: allB,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text ?? '-'),
        bold: opts.bold || false,
        size: opts.size || 20,
        font: 'Arial'
      })]
    })]
  });
}

async function generateMarksheet(s) {
  const scoreRows = [
    ['PRACTICAL - 1st Paper', '/100', s.practical_paper1],
    ['PRACTICAL - 2nd Paper', '/100', s.practical_paper2],
    ['PRACTICAL - Fabric', '/100', s.practical_fabric],
    ['Internal Assessment - Composition', '/20', s.ia_composition],
    ['Internal Assessment - Illustration', '/20', s.ia_illustration],
    ['Internal Assessment - Still Life', '/20', s.ia_still_life],
    ['Internal Assessment - Press Layout', '/20', s.ia_press_layout],
    ['Internal Assessment - Landscape', '/20', s.ia_landscape],
    ['Internal Assessment - Book Cover', '/20', s.ia_book_cover],
    ['Internal Assessment - Lettering', '/20', s.ia_lettering],
    ['Internal Assessment - Sketch', '/20', s.ia_sketch],
    ['Internal Assessment - Poster Design', '/20', s.ia_poster_design],
    ['Internal Assessment Total', '/100', s.ia_total],
    ['Oral', '/50', s.oral],
    ['Theory - Paper I', '/50', s.theory_paper1],
    ['Theory - Paper II', '/50', s.theory_paper2],
  ];

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: 'ASSAM TALENT COUNCIL', bold: true, size: 32, font: 'Arial' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: 'MARKS SHEET', bold: true, size: 28, font: 'Arial' })] }),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          rows: [
            new TableRow({ children: [
              c('Roll Number', { bold: true, width: 3600, shading: 'F0F0F0' }),
              c(s.roll_no, { width: 5760, bold: true })
            ]}),
            new TableRow({ children: [c('Name', { bold: true, shading: 'F0F0F0' }), c(s.name)] }),
            new TableRow({ children: [c('Father\'s Name', { bold: true, shading: 'F0F0F0' }), c(s.father_name)] }),
            new TableRow({ children: [c('Year / Class', { bold: true, shading: 'F0F0F0' }), c(s.year)] }),
            new TableRow({ children: [c('Subject', { bold: true, shading: 'F0F0F0' }), c(s.subject || 'PAINTING')] }),
            new TableRow({ children: [c('Centre', { bold: true, shading: 'F0F0F0' }), c(s.center_name)] }),
          ]
        }),

        new Paragraph({ text: '', spacing: { before: 240 } }),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          rows: [
            new TableRow({ children: [
              c('SUBJECT / PAPER', { bold: true, width: 5000, shading: 'DDEEFF', align: AlignmentType.CENTER }),
              c('MAX', { bold: true, width: 1500, shading: 'DDEEFF', align: AlignmentType.CENTER }),
              c('MARKS OBTAINED', { bold: true, width: 2860, shading: 'DDEEFF', align: AlignmentType.CENTER }),
            ]}),
            ...scoreRows.map(([label, max, val]) =>
              new TableRow({ children: [
                c(label, { width: 5000 }),
                c(max, { width: 1500, align: AlignmentType.CENTER }),
                c(val != null ? String(val) : '', { width: 2860, align: AlignmentType.CENTER, bold: true }),
              ]})),
            new TableRow({ children: [
              c('TOTAL MARKS', { bold: true, shading: 'FFFDE0', width: 5000 }),
              c('/500', { width: 1500, align: AlignmentType.CENTER, shading: 'FFFDE0' }),
              c(s.total_marks != null ? String(s.total_marks) : '', {
                width: 2860, align: AlignmentType.CENTER, bold: true, shading: 'FFFDE0', size: 22
              }),
            ]}),
          ]
        }),

        new Paragraph({ text: '', spacing: { before: 200 } }),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          rows: [
            new TableRow({ children: [
              c('Division', { bold: true, width: 3000, shading: 'F0F0F0' }),
              c(s.division || '-', { bold: true, width: 2180 }),
              c('Distinction', { bold: true, width: 2000, shading: 'F0F0F0' }),
              c(s.distinction || '-', { bold: true, width: 2180 }),
            ]}),
            new TableRow({ children: [
              c('Certificate No.', { bold: true, shading: 'F0F0F0' }),
              c(s.certificate_no || '-', { bold: true, colSpan: 3 }),
              c('', {}), c('', {}),
            ]}),
          ]
        }),

        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 600 },
          children: [new TextRun({ text: 'Controller of Examinations', bold: true, size: 20, font: 'Arial' })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 60 },
          children: [new TextRun({ text: 'ASSAM TALENT COUNCIL', size: 18, font: 'Arial' })] }),
      ]
    }]
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateMarksheet };
