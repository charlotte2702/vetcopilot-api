// pdfkit-based PDF generator — works everywhere (local, Vercel, AWS Lambda)
// with zero binary dependencies.
//
// Each `generateXxxPdf(data)` returns a Promise<Buffer>. The Buffer is what
// gets streamed back to the HTTP response. The actual drawing primitives live
// in lib/pdf.js — this module is the thin per-document orchestrator.

const pdf = require('./pdf');

// Run `buildFn(doc)` against a fresh PDFKit document and resolve the resulting
// PDF as a Buffer. Centralizes the doc lifecycle + chunk collection + error
// propagation so the per-document generators stay focused on layout.
function buildPdf(buildFn) {
  return new Promise((resolve, reject) => {
    let settled = false;
    try {
      const doc = pdf.createDoc();
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks)); } });
      doc.on('error', err => { if (!settled) { settled = true; reject(err); } });
      try {
        buildFn(doc);
      } catch (err) {
        if (!settled) { settled = true; reject(err); }
        return;
      }
      pdf.drawFooter(doc); // running footer on every page (pagination + disclaimer)
      doc.end();
    } catch (err) {
      if (!settled) { settled = true; reject(err); }
    }
  });
}

// ----- ORDONNANCE ------------------------------------------------------------

async function generateOrdonnancePdf(data) {
  const {
    patient = {}, diagnostic, clinique = [], pharmacie = [],
    alerteAllergies = [], ordonnanceNum, date, vet, ordreNum,
  } = data || {};

  const num = ordonnanceNum || `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const patientLine = `${patient.nm || 'Patient'}${patient.sp ? ' — ' + patient.sp : ''}${patient.breed ? ' (' + patient.breed + ')' : ''}`.trim();
  const patientSub = [patient.age, patient.sex, patient.wt].filter(Boolean).join(' · ');
  const ownerLine = patient.owner || 'Propriétaire non précisé';
  const ownerSub = patient.phone || '';
  const dateStr = date || pdf.formatDate();

  return buildPdf(doc => {
    pdf.drawOrdonnanceHeader(doc, { ordonnanceNum: num, diagnostic, date: dateStr });
    pdf.drawPatientBlock(doc, { patientLine, patientSub, ownerLine, ownerSub });

    if (alerteAllergies && alerteAllergies.length) {
      pdf.drawAlertBox(doc, alerteAllergies);
    }

    if (clinique.length) {
      pdf.drawOrdonnanceSectionHeader(doc, {
        title: 'Délivré par la clinique (à remettre ce jour)',
        color: pdf.COLORS.TEAL,
        icon: '+',
      });
      clinique.forEach((m, i) => pdf.drawMedicationRow(doc, m, i + 1, true));
    }

    if (pharmacie.length) {
      pdf.drawOrdonnanceSectionHeader(doc, {
        title: 'À acheter en pharmacie',
        color: pdf.COLORS.NAVY,
        icon: 'Rx',
      });
      pharmacie.forEach((m, i) => pdf.drawMedicationRow(doc, m, i + 1, false));
    }

    pdf.drawDisclaimer(
      doc,
      "Le vétérinaire prescripteur reste seul responsable de la prescription. " +
      "Ordonnance valable 1 an pour la dispensation initiale, 6 mois pour le renouvellement. " +
      "À usage vétérinaire exclusif. Conserver hors de portée des enfants et des animaux."
    );

    pdf.drawSignatureBlock(doc, { vet: vet || 'Dr. Jean Martin', ordreNum: ordreNum || '75-12345' });
  });
}

// ----- DIAGNOSTIC ------------------------------------------------------------

async function generateDiagnosticPdf(data) {
  const {
    patient = {}, symptoms, result = {}, date, vet,
  } = data || {};

  const patientLine = `${patient.nm || 'Patient'}${patient.sp ? ' — ' + patient.sp : ''}${patient.breed ? ' (' + patient.breed + ')' : ''}`.trim();
  const patientSub = [patient.age, patient.sex, patient.wt].filter(Boolean).join(' · ');
  const ownerLine = patient.owner || 'Propriétaire non précisé';
  const ownerSub = patient.phone || '';
  const dateStr = date || pdf.formatDate();
  const hypotheses = Array.isArray(result.hypotheses) ? result.hypotheses : [];

  return buildPdf(doc => {
    pdf.drawHeader(doc, {
      title: 'Aide au diagnostic',
      subtitle: 'Analyse IA des symptômes — Document d\'aide à la décision',
      date: dateStr,
    });
    pdf.drawPatientBlock(doc, { patientLine, patientSub, ownerLine, ownerSub });

    if (symptoms) {
      // Reset doc.x to the left margin (some helpers leave it shifted),
      // then let pdfkit's natural flow handle vertical positioning.
      doc.x = 50;
      doc.fillColor(pdf.COLORS.TEAL).font('Helvetica-Bold').fontSize(8);
      doc.text('SYMPTÔMES RAPPORTÉS', { characterSpacing: 0.6 });
      doc.moveDown(0.4);
      doc.fillColor(pdf.COLORS.TXT).font('Helvetica-Oblique').fontSize(10).lineGap(1.5);
      doc.text(symptoms, { width: doc.page.width - 100 });
      doc.moveDown(1);
    }

    pdf.drawUrgencyBadge(doc, { urgency: result.urgency, urgencyLabel: result.urgencyLabel });

    doc.fillColor(pdf.COLORS.NAVY).font('Helvetica-Bold').fontSize(12)
      .text('Hypothèses diagnostiques', 50, doc.y);
    doc.moveDown(0.6);

    hypotheses.forEach((h, i) => {
      pdf.drawHypothesis(doc, {
        index: i + 1,
        name: h.nm || 'Hypothèse',
        prob: h.prob || 0,
        level: h.lv || 'lo',
        desc: h.desc,
        exams: h.exams,
      });
    });

    pdf.drawDisclaimer(
      doc,
      "Cette analyse est générée par IA à titre indicatif. Elle ne remplace en aucun cas " +
      "l'examen clinique, les examens complémentaires et le jugement professionnel du vétérinaire. " +
      "Le praticien reste seul responsable du diagnostic final."
    );

    pdf.drawSignatureBlock(doc, { vet: vet || 'Dr. Jean Martin', ordreNum: '75-12345' });
  });
}

// ----- SOAP ------------------------------------------------------------------

async function generateSoapPdf(data) {
  const {
    patient = {}, soap = {}, ownerSummary, date, vet,
  } = data || {};

  const patientLine = `${patient.nm || 'Patient'}${patient.sp ? ' — ' + patient.sp : ''}${patient.breed ? ' (' + patient.breed + ')' : ''}`.trim();
  const patientSub = [patient.age, patient.sex, patient.wt].filter(Boolean).join(' · ');
  const ownerLine = patient.owner || 'Propriétaire non précisé';
  const ownerSub = patient.phone || '';
  const dateStr = date || pdf.formatDate();

  return buildPdf(doc => {
    pdf.drawHeader(doc, {
      title: 'Compte rendu de consultation',
      subtitle: 'Format SOAP — Document professionnel',
      date: dateStr,
    });
    pdf.drawPatientBlock(doc, { patientLine, patientSub, ownerLine, ownerSub });

    pdf.drawSoapSection(doc, { letter: 'S', title: 'Subjectif — motif & anamnèse',      content: soap.S });
    pdf.drawSoapSection(doc, { letter: 'O', title: 'Objectif — examen clinique',        content: soap.O });
    pdf.drawSoapSection(doc, { letter: 'A', title: 'Analyse — suspicion diagnostique',  content: soap.A });
    pdf.drawSoapSection(doc, { letter: 'P', title: 'Plan — examens, traitement, suivi', content: soap.P });

    if (ownerSummary && String(ownerSummary).trim()) {
      doc.moveDown(0.5);
      doc.fillColor(pdf.COLORS.NAVY).font('Helvetica-Bold').fontSize(11)
        .text('Résumé pour le propriétaire', 50);
      doc.moveDown(0.4);
      doc.fillColor(pdf.COLORS.TXT).font('Helvetica').fontSize(10).lineGap(2)
        .text(ownerSummary, 50, doc.y, { width: doc.page.width - 100 });
      doc.moveDown(0.6);
    }

    pdf.drawDisclaimer(
      doc,
      "Compte rendu rédigé avec l'aide de l'IA, vérifié et validé par le praticien. " +
      "Le vétérinaire signataire reste seul responsable du contenu clinique de ce document. " +
      "Conserver dans le dossier médical du patient."
    );

    pdf.drawSignatureBlock(doc, { vet: vet || 'Dr. Jean Martin', ordreNum: '75-12345' });
  });
}

// ----- INVOICE ---------------------------------------------------------------

const STATUS_LABEL = { paid: 'PAYÉE', pending: 'EN ATTENTE', overdue: 'EN RETARD' };
const STATUS_COLOR = { paid: '#16a34a', pending: '#e67e22', overdue: '#dc2626' };

async function generateInvoicePdf(data) {
  const {
    id, date, animal, client, animalId, actes = [], total, status, vet,
    patient = {}, // optional richer patient block
  } = data || {};

  const pw = 595;          // A4 width
  const MARGIN = 50;
  const dateStr = date ? formatPrettyDate(date) : pdf.formatDate();

  return buildPdf(doc => {
    pdf.drawHeader(doc, {
      title: 'Facture',
      subtitle: `N° ${id || '—'}  ·  Document comptable`,
      date: dateStr,
    });

    // Patient + Client block (reuse drawPatientBlock for consistency)
    const patientLine = `${animal || patient.nm || 'Patient'}${patient.sp ? ' — ' + patient.sp : ''}${patient.breed ? ' (' + patient.breed + ')' : ''}`;
    const patientSub = [patient.age, patient.sex, patient.wt].filter(Boolean).join(' · ');
    pdf.drawPatientBlock(doc, {
      patientLine,
      patientSub,
      ownerLine: client || 'Client non précisé',
      ownerSub: patient.phone || '',
    });

    // Status badge row
    const statusColor = STATUS_COLOR[status] || pdf.COLORS.TXT2;
    const statusLabel = STATUS_LABEL[status] || (status || '').toUpperCase();
    const badgeY = doc.y;
    doc.save();
    doc.font('Helvetica-Bold').fontSize(9);
    const badgeText = `STATUT : ${statusLabel}`;
    const badgeW = doc.widthOfString(badgeText) + 24;
    doc.roundedRect(MARGIN, badgeY, badgeW, 24, 4).fill(statusColor);
    doc.fillColor('white').text(badgeText, MARGIN + 12, badgeY + 8, { lineBreak: false });
    doc.restore();
    doc.y = badgeY + 36;
    doc.x = MARGIN;

    // Acts table
    drawInvoiceTable(doc, actes, total);

    pdf.drawDisclaimer(
      doc,
      'TVA non applicable, article 293 B du CGI (sauf mention contraire). ' +
      'Facture acquittée vaut quittance. ' +
      'En cas de retard de paiement, intérêts au taux légal majoré de 10 points + 40 € d\'indemnité forfaitaire (art. L441-10 C. com.). ' +
      'Conserver dans vos archives comptables.'
    );

    pdf.drawSignatureBlock(doc, { vet: vet || 'Dr. Jean Martin', ordreNum: '75-12345' });
  });
}

// Format ISO YYYY-MM-DD to DD/MM/YYYY for display in PDFs.
function formatPrettyDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return iso || '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function drawInvoiceTable(doc, actes, total) {
  const MARGIN = 50;
  const pw = doc.page.width;
  const w = pw - 2 * MARGIN;

  // Column geometry — anchored to the right edge to guarantee no overflow.
  // Columns: name (flex) | qty (40) | unit price (75) | total (75), right-aligned.
  const RIGHT_PAD = 14;
  const colTotalRight = MARGIN + w - RIGHT_PAD;
  const colTotalX = colTotalRight - 75;
  const colUnitX  = colTotalX - 10 - 75;
  const colQtyX   = colUnitX  - 10 - 40;
  const colNameW  = colQtyX   - (MARGIN + 12) - 8; // 12px inner pad + 8px gap before qty

  // Header row
  const headY = doc.y;
  doc.save();
  doc.roundedRect(MARGIN, headY, w, 26, 4).fill(pdf.COLORS.NAVY);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5).text('PRESTATION / ACTE', MARGIN + 12, headY + 9, { width: colNameW, lineBreak: false, characterSpacing: 0.5 });
  doc.text('QTÉ',          colQtyX,   headY + 9, { width: 40, align: 'right', lineBreak: false, characterSpacing: 0.5 });
  doc.text('PRIX UNIT.',   colUnitX,  headY + 9, { width: 75, align: 'right', lineBreak: false, characterSpacing: 0.5 });
  doc.text('TOTAL',        colTotalX, headY + 9, { width: 75, align: 'right', lineBreak: false, characterSpacing: 0.5 });
  doc.restore();
  doc.y = headY + 32;

  // Rows
  doc.fillColor(pdf.COLORS.TXT).font('Helvetica').fontSize(10);
  for (const act of actes) {
    const qty = Number(act.qty) || 1;
    const price = Number(act.price) || 0;
    const lineTotal = qty * price;
    const rowY = doc.y;
    const rowH = 22;

    // Subtle separator
    doc.save();
    doc.moveTo(MARGIN, rowY + rowH).lineTo(pw - MARGIN, rowY + rowH).strokeColor(pdf.COLORS.LIGHT).lineWidth(0.5).stroke();
    doc.restore();

    doc.text(act.nm || '—',          MARGIN + 12, rowY + 6, { width: colNameW, lineBreak: false, ellipsis: true });
    doc.text(String(qty),            colQtyX,    rowY + 6, { width: 40, align: 'right', lineBreak: false });
    doc.text(`${price.toFixed(2)} €`, colUnitX,   rowY + 6, { width: 75, align: 'right', lineBreak: false });
    doc.fillColor(pdf.COLORS.NAVY).font('Helvetica-Bold');
    doc.text(`${lineTotal.toFixed(2)} €`, colTotalX, rowY + 6, { width: 75, align: 'right', lineBreak: false });
    doc.fillColor(pdf.COLORS.TXT).font('Helvetica');

    doc.y = rowY + rowH;
  }

  // Total row
  doc.moveDown(0.5);
  const totalY = doc.y;
  const totalH = 32;
  doc.save();
  doc.roundedRect(MARGIN, totalY, w, totalH, 6).fillAndStroke(pdf.COLORS.BG, pdf.COLORS.LIGHT);
  doc.restore();
  doc.fillColor(pdf.COLORS.TXT2).font('Helvetica-Bold').fontSize(9)
    .text('TOTAL TTC', MARGIN + 12, totalY + 11, { width: w / 2, lineBreak: false, characterSpacing: 0.6 });
  const totalNum = Number(total) || actes.reduce((s, a) => s + (Number(a.qty) || 1) * (Number(a.price) || 0), 0);
  doc.fillColor(pdf.COLORS.NAVY).font('Helvetica-Bold').fontSize(15)
    .text(`${totalNum.toFixed(2)} €`, MARGIN + w - 130, totalY + 8, { width: 118, align: 'right', lineBreak: false });
  doc.y = totalY + totalH + 16;
  doc.x = MARGIN;
}

module.exports = {
  generateOrdonnancePdf,
  generateDiagnosticPdf,
  generateSoapPdf,
  generateInvoicePdf,
};
