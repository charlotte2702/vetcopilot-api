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

module.exports = {
  generateOrdonnancePdf,
  generateDiagnosticPdf,
  generateSoapPdf,
};
