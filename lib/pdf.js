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

// French-style prescription header: centered logo + clinic, double rule,
// large centered ORDONNANCE title, then a metadata strip (N°, date, diagnostic).
function drawOrdonnanceHeader(doc, { ordonnanceNum, diagnostic, date }) {
  const pw = doc.page.width;

  // Centered logo + clinic name (compute group width and center)
  const logoSize = 34;
  doc.font('Helvetica-Bold').fontSize(16);
  const nameW = doc.widthOfString('VetCopilot');
  const groupW = logoSize + 12 + nameW;
  const groupX = (pw - groupW) / 2;
  const topY = 42;

  // Navy logo with white V
  doc.save();
  doc.rect(groupX, topY, logoSize, logoSize).fill(COLORS.NAVY);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text('V', groupX, topY + 5, { width: logoSize, align: 'center', lineBreak: false });
  doc.restore();

  // Clinic name right of logo, vertically centered
  doc.fillColor(COLORS.NAVY).font('Helvetica-Bold').fontSize(16).text('VetCopilot', groupX + logoSize + 12, topY + 6, { lineBreak: false });

  // Centered address line
  doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(8.5)
    .text('Clinique Vétérinaire VetCopilot  ·  15 rue de la Santé, 75013 Paris  ·  01 23 45 67 89',
      MARGIN, topY + logoSize + 6, { width: pw - 2 * MARGIN, align: 'center' });

  // Double rule (navy bold + teal thin) — classic prescription divider
  const ruleY = topY + logoSize + 24;
  doc.save();
  doc.moveTo(MARGIN, ruleY).lineTo(pw - MARGIN, ruleY).strokeColor(COLORS.NAVY).lineWidth(1.2).stroke();
  doc.moveTo(MARGIN, ruleY + 3).lineTo(pw - MARGIN, ruleY + 3).strokeColor(COLORS.TEAL).lineWidth(0.5).stroke();
  doc.restore();

  // Large centered ORDONNANCE title with letter-spacing
  const titleY = ruleY + 16;
  doc.fillColor(COLORS.NAVY).font('Helvetica-Bold').fontSize(22)
    .text('ORDONNANCE', MARGIN, titleY, { width: pw - 2 * MARGIN, align: 'center', characterSpacing: 3, lineBreak: false });

  // Metadata strip: N°, Date, Diagnostic
  const metaY = titleY + 36;
  const innerW = pw - 2 * MARGIN;
  const colLabelFont = 7;
  const colValFont = 9.5;

  doc.save();
  doc.roundedRect(MARGIN, metaY, innerW, diagnostic ? 46 : 30, 4).fill(COLORS.BG);
  doc.restore();

  // N° on the left
  doc.fillColor(COLORS.MUTED).font('Helvetica-Bold').fontSize(colLabelFont).text('N° ORDONNANCE', MARGIN + 14, metaY + 7, { characterSpacing: 0.6, lineBreak: false });
  doc.fillColor(COLORS.TXT).font('Helvetica-Bold').fontSize(colValFont).text(safeText(ordonnanceNum || '—'), MARGIN + 14, metaY + 17, { lineBreak: false });

  // Date on the right
  doc.fillColor(COLORS.MUTED).font('Helvetica-Bold').fontSize(colLabelFont).text('DATE', MARGIN + 14, metaY + 7, { width: innerW - 28, align: 'right', characterSpacing: 0.6, lineBreak: false });
  doc.fillColor(COLORS.TXT).font('Helvetica-Bold').fontSize(colValFont).text(safeText(date || '—'), MARGIN + 14, metaY + 17, { width: innerW - 28, align: 'right', lineBreak: false });

  // Diagnostic full-width on second row
  if (diagnostic) {
    doc.save();
    doc.moveTo(MARGIN + 14, metaY + 32).lineTo(pw - MARGIN - 14, metaY + 32).strokeColor(COLORS.LIGHT).lineWidth(0.4).stroke();
    doc.restore();
    doc.fillColor(COLORS.MUTED).font('Helvetica-Bold').fontSize(colLabelFont).text('DIAGNOSTIC', MARGIN + 14, metaY + 36, { characterSpacing: 0.6, lineBreak: false });
    doc.fillColor(COLORS.TXT).font('Helvetica').fontSize(9).text(safeText(diagnostic), MARGIN + 72, metaY + 36, { width: innerW - 86, lineBreak: false, ellipsis: true });
  }

  doc.y = metaY + (diagnostic ? 46 : 30) + 16;
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

// Measure-first alert box: actually compute the wrapped text height for each
// alert, sum them, then draw the rectangle to fit exactly.
function drawAlertBox(doc, alerts) {
  if (!alerts || !alerts.length) return;
  const pw = doc.page.width;
  const w = pw - 2 * MARGIN;
  const PAD = 15;
  const TITLE_H = 12;
  const GAP_TITLE = 8;
  const GAP_BETWEEN_ITEMS = 6;
  const textW = w - 2 * PAD;

  // Measure each alert at 8.5pt regular, wrapped to textW
  doc.font('Helvetica').fontSize(8.5);
  const heights = alerts.map(a => doc.heightOfString(`• ${safeText(a)}`, { width: textW, lineGap: 1 }));
  const alertsH = heights.reduce((s, h) => s + h, 0) + GAP_BETWEEN_ITEMS * Math.max(0, alerts.length - 1);
  const boxH = PAD + TITLE_H + GAP_TITLE + alertsH + PAD;

  ensureSpace(doc, boxH + 10);
  const y0 = doc.y;

  doc.save();
  doc.roundedRect(MARGIN, y0, w, boxH, 4).fillAndStroke('#fdecec', COLORS.RED);
  doc.restore();

  doc.fillColor(COLORS.RED).font('Helvetica-Bold').fontSize(8.5)
    .text('ALERTES ALLERGIES & CONTRE-INDICATIONS', MARGIN + PAD, y0 + PAD, { width: textW, characterSpacing: 0.6, lineBreak: false });

  let cy = y0 + PAD + TITLE_H + GAP_TITLE;
  doc.fillColor(COLORS.TXT).font('Helvetica').fontSize(8.5);
  alerts.forEach((alert, i) => {
    doc.text(`• ${safeText(alert)}`, MARGIN + PAD, cy, { width: textW, lineGap: 1 });
    cy += heights[i] + (i < alerts.length - 1 ? GAP_BETWEEN_ITEMS : 0);
  });

  doc.y = y0 + boxH + 14;
  doc.x = MARGIN;
}

// Section header with a white icon-chip on the left (visual hook), then bold
// uppercase title. `icon` is a short 1–2 char marker rendered inside the chip
// — keep it WinAnsi-safe (no emoji).
function drawOrdonnanceSectionHeader(doc, { title, color = COLORS.NAVY, icon = '+' }) {
  const pw = doc.page.width;
  const w = pw - 2 * MARGIN;
  ensureSpace(doc, 50);
  const y0 = doc.y;
  const barH = 30;

  // Background bar
  doc.save();
  doc.roundedRect(MARGIN, y0, w, barH, 6).fill(color);
  doc.restore();

  // White circle "icon chip" on the left
  const chipR = 10;
  const chipCx = MARGIN + 16 + chipR;
  const chipCy = y0 + barH / 2;
  doc.save();
  doc.circle(chipCx, chipCy, chipR).fill('white');
  doc.fillColor(color).font('Helvetica-Bold').fontSize(11)
    .text(String(icon), chipCx - chipR, chipCy - 5, { width: chipR * 2, align: 'center', lineBreak: false });
  doc.restore();

  // Title text
  doc.fillColor('white').font('Helvetica-Bold').fontSize(11.5)
    .text(safeText(title).toUpperCase(), chipCx + chipR + 10, y0 + 10, { characterSpacing: 0.8, lineBreak: false });

  doc.y = y0 + barH + 10;
  doc.x = MARGIN;
}

// Single medication card — **measure-first**. We:
//   1) Build a list of content blocks (title, forme, divider, dose, adm, remarques)
//   2) Measure each block's wrapped height with `heightOfString` at its real font/width
//   3) Sum + paddings + inter-block gaps to get the exact card height
//   4) Draw the rectangle at that exact height
//   5) Render the text — wrapping is enabled (no `lineBreak: false`) so nothing overflows
//
// Layout:
//   ┌─ PAD ───────────────────────────────────────────────────────── PAD ─┐
//   │ [ ☐ ]  ⓿   NOM COMMERCIAL  — DCI (italic)                            │
//   │            forme galénique                                            │
//   │            ───────────────────────────────────────────────            │
//   │            Posologie : 1 mg/kg   ·   Dose : 32 mg  (teal bold)       │
//   │            Voie : SC  |  Fréquence : 1x/jour  |  Durée : 3 jours    │
//   │            Remarques en italique                                      │
//   └─ PAD ────────────────────────────────────────────────────────────────┘
function drawMedicationRow(doc, m, num, withCheckbox) {
  const pw = doc.page.width;
  const w = pw - 2 * MARGIN;
  const cardX = MARGIN;
  const PAD = 15;          // user-requested inner padding
  const BLOCK_GAP = 8;     // vertical space between content blocks
  const DIVIDER_PAD = 4;   // extra space around the divider line

  // Left rail: optional checkbox + numbered badge
  const CHECKBOX_W = withCheckbox ? 22 : 0;  // 13 box + 9 gap
  const BADGE_W = 22 + 12;                    // 22 circle + 12 gap to text
  const textX = cardX + PAD + CHECKBOX_W + BADGE_W;
  const textW = (cardX + w - PAD) - textX;

  // Prepare strings
  const nameStr = safeText(m.nm || 'Médicament').toUpperCase();
  const dciStr  = m.dci  ? safeText(m.dci)  : '';
  const formeStr = m.forme ? safeText(m.forme) : '';
  const remarquesStr = (m.remarques && String(m.remarques).trim()) ? safeText(m.remarques) : '';

  const doseParts = [];
  if (m.dose_par_kg)   doseParts.push(`Posologie : ${safeText(m.dose_par_kg)}`);
  if (m.dose_calculee) doseParts.push(`Dose : ${safeText(m.dose_calculee)}`);
  const doseStr = doseParts.join('   ·   ');

  const admParts = [];
  if (m.voie)      admParts.push(`Voie : ${safeText(m.voie)}`);
  if (m.frequence) admParts.push(`Fréquence : ${safeText(m.frequence)}`);
  if (m.duree)     admParts.push(`Durée : ${safeText(m.duree)}`);
  const admStr = admParts.join('   |   ');

  // Decide: try to fit "NAME — DCI" on a single line; else stack.
  doc.font('Helvetica-Bold').fontSize(11.5);
  const nameW = doc.widthOfString(nameStr);
  doc.font('Helvetica-Oblique').fontSize(10);
  const dciInlineSuffix = dciStr ? `  —  ${dciStr}` : '';
  const dciInlineW = dciStr ? doc.widthOfString(dciInlineSuffix) : 0;
  const titleInline = dciStr && (nameW + dciInlineW <= textW);

  // Build blocks with font specs for measuring
  const fontMap = {
    'name-dci':  ['Helvetica-Bold', 11.5, COLORS.NAVY],
    'name':      ['Helvetica-Bold', 11.5, COLORS.NAVY],
    'dci':       ['Helvetica-Oblique', 10, COLORS.TXT2],
    'forme':     ['Helvetica', 8.5, COLORS.TXT2],
    'dose':      ['Helvetica-Bold', 9.5, COLORS.TEAL],
    'adm':       ['Helvetica', 9.5, COLORS.TXT],
    'remarques': ['Helvetica-Oblique', 8.5, COLORS.TXT2],
  };

  const blocks = [];
  if (titleInline) {
    blocks.push({ kind: 'name-dci', text: nameStr, suffix: dciInlineSuffix, nameW });
  } else {
    blocks.push({ kind: 'name', text: nameStr });
    if (dciStr) blocks.push({ kind: 'dci', text: dciStr });
  }
  if (formeStr) blocks.push({ kind: 'forme', text: formeStr });
  blocks.push({ kind: 'divider' });
  if (doseStr) blocks.push({ kind: 'dose', text: doseStr });
  if (admStr)  blocks.push({ kind: 'adm',  text: admStr });
  if (remarquesStr) blocks.push({ kind: 'remarques', text: remarquesStr });

  // Measure each block's height in the text column
  for (const b of blocks) {
    if (b.kind === 'divider') { b.height = 1; continue; }
    const [fontName, fontSize] = fontMap[b.kind];
    doc.font(fontName).fontSize(fontSize);
    b.height = doc.heightOfString(b.text, { width: textW });
  }

  // Compute total card height
  let innerH = 0;
  blocks.forEach((b, i) => {
    innerH += b.height;
    if (i < blocks.length - 1) {
      // Add a little extra padding around the divider for visual breathing
      const isDivider = b.kind === 'divider' || blocks[i + 1].kind === 'divider';
      innerH += isDivider ? (BLOCK_GAP + DIVIDER_PAD) : BLOCK_GAP;
    }
  });
  const cardH = PAD + innerH + PAD;

  // Page break if needed
  ensureSpace(doc, cardH + 10);
  const y0 = doc.y;

  // 1) Draw the card background at the EXACT computed height
  doc.save();
  doc.roundedRect(cardX, y0, w, cardH, 6).fillAndStroke('#f7f9fa', COLORS.LIGHT);
  doc.restore();

  // 2) Draw checkbox (if delivery section)
  if (withCheckbox) {
    doc.save();
    doc.rect(cardX + PAD, y0 + PAD + 1, 13, 13).strokeColor(COLORS.NAVY).lineWidth(1).stroke();
    doc.restore();
  }

  // 3) Draw the numbered teal badge — vertically aligned with the title line
  const badgeCx = cardX + PAD + CHECKBOX_W + 11;
  const badgeCy = y0 + PAD + 7;
  doc.save();
  doc.circle(badgeCx, badgeCy, 11).fill(COLORS.TEAL);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
    .text(String(num), badgeCx - 11, badgeCy - 5.5, { width: 22, align: 'center', lineBreak: false });
  doc.restore();

  // 4) Draw text blocks (wrapping enabled)
  let cy = y0 + PAD;
  blocks.forEach((b, i) => {
    if (b.kind === 'divider') {
      doc.save();
      doc.moveTo(textX, cy + 0.5).lineTo(textX + textW, cy + 0.5).strokeColor(COLORS.LIGHT).lineWidth(0.5).stroke();
      doc.restore();
    } else if (b.kind === 'name-dci') {
      // Render NAME, then DCI immediately after (italic, gray)
      doc.fillColor(COLORS.NAVY).font('Helvetica-Bold').fontSize(11.5)
        .text(b.text, textX, cy, { width: textW, lineBreak: false });
      doc.fillColor(COLORS.TXT2).font('Helvetica-Oblique').fontSize(10)
        .text(b.suffix, textX + b.nameW, cy + 2, { lineBreak: false });
    } else {
      const [fontName, fontSize, color] = fontMap[b.kind];
      doc.fillColor(color).font(fontName).fontSize(fontSize)
        .text(b.text, textX, cy, { width: textW });
    }
    cy += b.height;
    if (i < blocks.length - 1) {
      const isDivider = b.kind === 'divider' || blocks[i + 1].kind === 'divider';
      cy += isDivider ? (BLOCK_GAP + DIVIDER_PAD) : BLOCK_GAP;
    }
  });

  // Advance the cursor below the card with consistent spacing
  doc.y = y0 + cardH + 10;
  doc.x = MARGIN;
}

// Two-column signature block, French prescription style:
//   Vétérinaire prescripteur (left)            Cachet et signature (right)
//   Dr. Jean Martin                            ........... dotted line ...........
//   N° Ordre : 75-12345
//   Clinique Vétérinaire VetCopilot
function drawSignatureBlock(doc, { vet, ordreNum }) {
  ensureSpace(doc, 80);
  const pw = doc.page.width;
  doc.moveDown(0.4);
  const y0 = doc.y;
  const innerW = pw - 2 * MARGIN;
  const colW = (innerW - 24) / 2;

  // Left column: vet identification
  doc.fillColor(COLORS.MUTED).font('Helvetica-Bold').fontSize(7)
    .text('VÉTÉRINAIRE PRESCRIPTEUR', MARGIN, y0, { characterSpacing: 0.6, lineBreak: false });
  doc.fillColor(COLORS.TXT).font('Helvetica-Bold').fontSize(11)
    .text(safeText(vet || 'Dr. Jean Martin'), MARGIN, y0 + 12, { lineBreak: false });
  doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(8.5)
    .text(`N° Ordre des Vétérinaires : ${safeText(ordreNum || '75-12345')}`, MARGIN, y0 + 28, { lineBreak: false });
  doc.fillColor(COLORS.TXT2).font('Helvetica').fontSize(8.5)
    .text('Clinique Vétérinaire VetCopilot', MARGIN, y0 + 41, { lineBreak: false });

  // Right column: signature area with dotted line
  const sigX = MARGIN + colW + 24;
  const sigW = colW;
  doc.fillColor(COLORS.MUTED).font('Helvetica-Bold').fontSize(7)
    .text('CACHET ET SIGNATURE', sigX, y0, { characterSpacing: 0.6, lineBreak: false });

  // Dotted line for signature (about 36px below label)
  const dotY = y0 + 44;
  doc.save();
  doc.dash(2, { space: 3 });
  doc.moveTo(sigX, dotY).lineTo(sigX + sigW, dotY).strokeColor(COLORS.TXT2).lineWidth(0.8).stroke();
  doc.undash();
  doc.restore();
  // Tiny label beneath the dotted line
  doc.fillColor(COLORS.MUTED).font('Helvetica-Oblique').fontSize(7)
    .text('Signature manuscrite du vétérinaire', sigX, dotY + 3, { width: sigW, align: 'center', lineBreak: false });

  doc.y = y0 + 64;
  doc.x = MARGIN;
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

// Sanitize a string for rendering with Helvetica (WinAnsi). Replaces Greek
// letters and other non-Latin1 chars that pdfkit's built-in fonts can't render.
function safeText(s) {
  if (s == null) return '';
  return String(s)
    .replace(/β/g, 'beta')
    .replace(/α/g, 'alpha')
    .replace(/γ/g, 'gamma')
    .replace(/[µμ]/g, 'mu')
    .replace(/⚠/g, '! ')
    .replace(/[✓✔]/g, '[v] ')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    // strip emoji blocks (Misc Symbols & Pictographs, Emoticons, Transport & Map, etc.)
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '');
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
  drawOrdonnanceHeader,
  drawAlertBox, drawOrdonnanceSectionHeader, drawMedicationRow, drawSignatureBlock,
  COLORS, URGENCY_COLOR,
};
