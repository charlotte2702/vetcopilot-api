// PDF rendering helpers using pdfkit.
//
// pdfkit's built-in Helvetica family uses WinAnsi encoding, which covers the
// French Latin-1 character set we need (à, é, ç, etc.). No external TTF needed.

const PDFDocument = require('pdfkit');

const COLORS = {
  NAVY:   '#0B1D34',
  TEAL:   '#2BA08F',
  GOLD:   '#C8A45C',
  TXT:    '#1a2230',
  TXT2:   '#5a6470',
  MUTED:  '#8a909a',
  LIGHT:  '#E9ECF1',
  BG:     '#f7f8fa',
  RED:    '#e74c3c',
  ORANGE: '#e67e22',
};

const URGENCY_COLOR = {
  faible:   COLORS.TEAL,
  moderee:  COLORS.ORANGE,
  elevee:   COLORS.RED,
  critique: COLORS.RED,
};

const MARGIN = 50;

function createDoc() {
  return new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 80, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: 'VetCopilot', Author: 'VetCopilot', Producer: 'VetCopilot API' },
  });
}

function formatDate(d = new Date()) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateForFilename(d = new Date()) {
  // YYYY-MM-DD, OS-friendly, sortable
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function drawHeader(doc, { title, subtitle, date }) {
  const pw = doc.page.width;

  // Logo: navy square with white "V"
  doc.save();
  doc.rect(MARGIN, 45, 34, 34).fill(COLORS.NAVY);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text('V', MARGIN, 51, { width: 34, align: 'center' });
  doc.restore();

  // Clinic info next to logo
  doc.fillColor(COLORS.NAVY).font('Helvetica-Bold').fontSize(15).text('VetCopilot', MARGIN + 46, 46);
  doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(8.5)
    .text('Clinique Vétérinaire VetCopilot', MARGIN + 46, 64)
    .text('15 rue de la Santé, 75013 Paris  ·  01 23 45 67 89', MARGIN + 46, 75);

  // Date in top-right corner
  const dateStr = date || formatDate();
  doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(9)
    .text(`Date : ${dateStr}`, MARGIN, 48, { align: 'right', width: pw - 2 * MARGIN });

  // Horizontal separator
  doc.moveTo(MARGIN, 92).lineTo(pw - MARGIN, 92).strokeColor(COLORS.LIGHT).lineWidth(0.7).stroke();

  // Title block
  doc.fillColor(COLORS.NAVY).font('Helvetica-Bold').fontSize(18).text(title, MARGIN, 110);
  if (subtitle) {
    doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(10).text(subtitle, MARGIN, doc.y + 2);
  }

  // Position cursor below header for body content
  doc.y = Math.max(doc.y, 140) + 14;
  doc.x = MARGIN;
}

function drawPatientBlock(doc, { patientLine, patientSub, ownerLine, ownerSub }) {
  const pw = doc.page.width;
  const blockW = pw - 2 * MARGIN;
  const colW = (blockW - 14) / 2;
  const y0 = doc.y;
  const blockH = 64;

  // Background
  doc.save();
  doc.roundedRect(MARGIN, y0, blockW, blockH, 6).fill(COLORS.BG);
  doc.restore();

  // Patient column
  doc.fillColor(COLORS.MUTED).font('Helvetica-Bold').fontSize(7).text('PATIENT', MARGIN + 14, y0 + 10, { characterSpacing: 0.5 });
  doc.fillColor(COLORS.TXT).font('Helvetica-Bold').fontSize(11).text(patientLine || '—', MARGIN + 14, y0 + 22, { width: colW - 14 });
  if (patientSub) {
    doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(9).text(patientSub, MARGIN + 14, y0 + 42, { width: colW - 14 });
  }

  // Owner column
  const ownerX = MARGIN + colW + 14;
  doc.fillColor(COLORS.MUTED).font('Helvetica-Bold').fontSize(7).text('PROPRIÉTAIRE', ownerX, y0 + 10);
  doc.fillColor(COLORS.TXT).font('Helvetica-Bold').fontSize(11).text(ownerLine || '—', ownerX, y0 + 22, { width: colW - 14 });
  if (ownerSub) {
    doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(9).text(ownerSub, ownerX, y0 + 42, { width: colW - 14 });
  }

  doc.y = y0 + blockH + 18;
  doc.x = MARGIN;
}

function drawSoapSection(doc, { letter, title, content }) {
  const pw = doc.page.width;
  const contentW = pw - 2 * MARGIN;

  ensureSpace(doc, 70);

  const y = doc.y;

  // Letter badge (teal circle with white capital letter)
  doc.save();
  doc.circle(MARGIN + 10, y + 10, 11).fill(COLORS.TEAL);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text(letter, MARGIN, y + 4, { width: 22, align: 'center' });
  doc.restore();

  // Section title
  doc.fillColor(COLORS.NAVY).font('Helvetica-Bold').fontSize(11.5).text(title, MARGIN + 30, y + 5);

  doc.y = y + 28;
  doc.x = MARGIN;

  // Section content
  doc.fillColor(COLORS.TXT).font('Helvetica').fontSize(10).lineGap(2)
    .text((content && String(content).trim()) || '(non renseigné)', MARGIN, doc.y, { width: contentW, align: 'left' });
  doc.moveDown(1.2);
}

function drawUrgencyBadge(doc, { urgency, urgencyLabel }) {
  const color = URGENCY_COLOR[urgency] || COLORS.TEAL;
  const label = urgencyLabel || (urgency || 'FAIBLE').toUpperCase();
  const text = `Urgence estimée : ${label}`;

  doc.font('Helvetica-Bold').fontSize(10);
  const w = doc.widthOfString(text) + 22;
  const y = doc.y;

  doc.save();
  doc.roundedRect(MARGIN, y, w, 22, 4).fill(color);
  doc.fillColor('white').text(text, MARGIN, y + 6, { width: w, align: 'center' });
  doc.restore();

  doc.y = y + 32;
  doc.x = MARGIN;
}

function drawHypothesis(doc, { index, name, prob, level, desc, exams }) {
  const pw = doc.page.width;
  const contentW = pw - 2 * MARGIN;

  ensureSpace(doc, 90 + (exams ? exams.length * 14 : 0));

  const y = doc.y;
  const probColor = level === 'hi' ? COLORS.ORANGE : COLORS.TEAL;

  // Title row: "N. Hypothesis name"            55%
  doc.fillColor(COLORS.NAVY).font('Helvetica-Bold').fontSize(11)
    .text(`${index}. ${name}`, MARGIN, y, { width: contentW - 50 });
  if (prob > 0) {
    doc.fillColor(probColor).font('Helvetica-Bold').fontSize(13)
      .text(`${prob}%`, MARGIN, y, { width: contentW, align: 'right' });
  }

  doc.y = Math.max(doc.y, y + 18) + 4;

  // Progress bar (gray track + colored fill)
  const barY = doc.y;
  doc.save();
  doc.roundedRect(MARGIN, barY, contentW, 5, 2.5).fill(COLORS.LIGHT);
  if (prob > 0) {
    const fillW = Math.max(4, contentW * (Math.min(prob, 100) / 100));
    doc.roundedRect(MARGIN, barY, fillW, 5, 2.5).fill(probColor);
  }
  doc.restore();
  doc.y = barY + 12;

  // Description
  if (desc) {
    doc.fillColor(COLORS.TXT2).font('Helvetica-Oblique').fontSize(9.5).lineGap(1)
      .text(desc, MARGIN, doc.y, { width: contentW });
    doc.moveDown(0.4);
  }

  // Exams list
  if (exams && exams.length) {
    doc.fillColor(COLORS.TEAL).font('Helvetica-Bold').fontSize(7.5).text('EXAMENS CONSEILLÉS', MARGIN, doc.y, { characterSpacing: 0.5 });
    doc.moveDown(0.2);
    doc.fillColor(COLORS.TXT).font('Helvetica').fontSize(9.5);
    for (const ex of exams) {
      doc.text(`•  ${ex}`, MARGIN + 6, doc.y, { width: contentW - 6 });
    }
  }

  doc.moveDown(1);

  // Light separator
  doc.save();
  doc.moveTo(MARGIN, doc.y).lineTo(pw - MARGIN, doc.y).strokeColor(COLORS.LIGHT).lineWidth(0.5).stroke();
  doc.restore();
  doc.moveDown(0.6);
}

function drawDisclaimer(doc, message) {
  const pw = doc.page.width;
  const w = pw - 2 * MARGIN;
  ensureSpace(doc, 40);
  const y = doc.y;
  doc.save();
  doc.roundedRect(MARGIN, y, w, 30, 4).fill('#fdf6e3'); // pale gold
  doc.fillColor(COLORS.GOLD).font('Helvetica-Bold').fontSize(8).text('ATTENTION', MARGIN + 12, y + 7, { characterSpacing: 0.8 });
  doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(8.5).text(message, MARGIN + 12, y + 17, { width: w - 24 });
  doc.restore();
  doc.y = y + 40;
}

function drawFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pw = doc.page.width;
    const ph = doc.page.height;
    const y = ph - 50;

    // Divider
    doc.save();
    doc.moveTo(MARGIN, y).lineTo(pw - MARGIN, y).strokeColor(COLORS.LIGHT).lineWidth(0.5).stroke();
    doc.restore();

    // `lineBreak: false` + `height` prevent pdfkit from spawning a new page
    // when writing into the bottom margin band.
    doc.fillColor(COLORS.MUTED).font('Helvetica').fontSize(7.5)
      .text("Généré par VetCopilot — L'IA est un outil d'aide, le vétérinaire garde la décision finale.",
        MARGIN, y + 8, { width: pw - 2 * MARGIN, align: 'center', lineBreak: false, height: 12 });
    doc.fillColor(COLORS.MUTED).font('Helvetica').fontSize(7)
      .text(`Page ${i - range.start + 1} / ${range.count}`,
        MARGIN, y + 22, { width: pw - 2 * MARGIN, align: 'center', lineBreak: false, height: 12 });
  }
}

// Push to a new page if the remaining vertical space is below `needed`.
function ensureSpace(doc, needed) {
  const remaining = doc.page.height - doc.page.margins.bottom - doc.y;
  if (remaining < needed) doc.addPage();
}

// Sanitize a string for use in a filename: replace spaces, accents,
// and shell-significant chars.
function safeFilenamePart(s) {
  return String(s || 'inconnu')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'inconnu';
}

module.exports = {
  createDoc, formatDate, formatDateForFilename, safeFilenamePart,
  drawHeader, drawPatientBlock, drawSoapSection, drawUrgencyBadge,
  drawHypothesis, drawDisclaimer, drawFooter,
  COLORS, URGENCY_COLOR,
};
