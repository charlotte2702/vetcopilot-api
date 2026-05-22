const {
  escapeHtml, formatDate, formatDateLong, CLINIC, LOGO_SVG, baseStyles, pageFooterTemplate,
} = require('./_common');
const E = escapeHtml;

// SOAP letter colors — 4 distinct hues so each section is instantly identifiable.
const SOAP_COLORS = {
  S: { bg: 'linear-gradient(135deg, #2BA08F, #1f8a76)', light: 'rgba(43,160,143,0.06)', border: '#2BA08F' },
  O: { bg: 'linear-gradient(135deg, #C8A45C, #b08a3f)', light: 'rgba(200,164,92,0.06)',  border: '#C8A45C' },
  A: { bg: 'linear-gradient(135deg, #9b59b6, #7e3f99)', light: 'rgba(155,89,182,0.06)',  border: '#9b59b6' },
  P: { bg: 'linear-gradient(135deg, #0B1D34, #14304f)', light: 'rgba(11,29,52,0.05)',    border: '#0B1D34' },
};

const SOAP_LABELS = {
  S: { title: 'Subjectif', sub: 'Motif & anamnèse' },
  O: { title: 'Objectif',  sub: 'Examen clinique' },
  A: { title: 'Analyse',   sub: 'Suspicion diagnostique' },
  P: { title: 'Plan',      sub: 'Examens, traitement & suivi' },
};

function soapSection(letter, content) {
  const colors = SOAP_COLORS[letter];
  const labels = SOAP_LABELS[letter];
  // Preserve newlines in content by converting them to <br>
  const html = E(content || '(non renseigné)').replace(/\n/g, '<br/>');
  return `<div class="soap-section">
    <div class="soap-head" style="background:${colors.bg};">
      <span class="soap-letter">${letter}</span>
      <div class="soap-titles">
        <div class="soap-title">${labels.title}</div>
        <div class="soap-sub">${labels.sub}</div>
      </div>
    </div>
    <div class="soap-body" style="border-left:3px solid ${colors.border};background:${colors.light};">
      ${html}
    </div>
  </div>`;
}

function render(data) {
  const {
    patient = {}, soap = {}, ownerSummary, date, vet, ordreNum, reportNum,
  } = data;
  const dateStr = date || formatDate();
  const dateLong = formatDateLong();
  const ref = reportNum || `CR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const patientName = `${patient.nm || 'Patient'}${patient.sp ? ' — ' + patient.sp : ''}${patient.breed ? ' (' + patient.breed + ')' : ''}`;
  const patientSub = [patient.age, patient.sex, patient.wt].filter(Boolean).join(' · ');
  const ownerSalutation = patient.owner && /^Mme/i.test(patient.owner) ? 'Chère' : 'Cher';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Compte rendu — ${E(patient.nm || '')}</title>
<style>${baseStyles()}
  .soap-section { margin-bottom: 14px; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(11,29,52,0.05); page-break-inside: avoid; }
  .soap-head { display: flex; align-items: center; gap: 14px; padding: 10px 16px; color: white; }
  .soap-letter { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 16pt; font-weight: 800; flex-shrink: 0; }
  .soap-titles { line-height: 1.2; }
  .soap-title { font-size: 11.5pt; font-weight: 800; letter-spacing: 0.04em; }
  .soap-sub { font-size: 8pt; opacity: 0.85; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.06em; }
  .soap-body { font-size: 10pt; color: #1a2230; line-height: 1.6; padding: 12px 16px; background: white; }

  .owner-summary { background: linear-gradient(135deg, rgba(43,160,143,0.06), rgba(43,160,143,0.02)); border: 1px solid rgba(43,160,143,0.25); border-radius: 10px; padding: 16px 20px; margin: 18px 0 14px; }
  .owner-summary-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(43,160,143,0.25); }
  .owner-summary-ic { width: 26px; height: 26px; border-radius: 50%; background: #2BA08F; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11pt; }
  .owner-summary-title { font-size: 10pt; font-weight: 800; color: #0B1D34; text-transform: uppercase; letter-spacing: 0.05em; }
  .owner-summary-body { font-size: 9.5pt; color: #1a2230; line-height: 1.65; }
  .owner-summary-body p { margin-bottom: 8px; }
  .owner-summary-body p:last-child { margin-bottom: 0; }

  .ref-block { display: grid; grid-template-columns: 1fr auto; gap: 16px; margin: 8px 0 14px; padding: 10px 16px; background: #f7f8fa; border-radius: 8px; align-items: center; font-size: 9pt; }
  .ref-block .label { font-size: 7pt; font-weight: 800; color: #8a909a; text-transform: uppercase; letter-spacing: 0.07em; }
  .ref-block .value { color: #0B1D34; font-weight: 700; }
</style></head>
<body>

  <div class="doc-header">
    <div class="doc-header-left">
      ${LOGO_SVG}
      <div class="doc-header-clinic">
        <h1>${E(CLINIC.name)}</h1>
        <div class="sub">${E(CLINIC.fullName)}<br/>${E(CLINIC.address)} · ${E(CLINIC.phone)}</div>
      </div>
    </div>
    <div class="doc-header-meta">
      <div class="ref">${E(ref)}</div>
      <div>${E(dateStr)}</div>
    </div>
  </div>
  <div class="doc-header-thin"></div>

  <div class="doc-title">Compte rendu</div>
  <div class="doc-subtitle">Format SOAP — Document professionnel</div>

  <div class="ref-block">
    <div>
      <span class="label">Référence</span> &nbsp; <span class="value">${E(ref)}</span>
    </div>
    <div>
      <span class="label">Consultation du</span> &nbsp; <span class="value">${E(dateLong)}</span>
    </div>
  </div>

  <div class="patient-block">
    <div>
      <div class="label">Patient</div>
      <div class="name">${E(patientName)}</div>
      ${patientSub ? `<div class="sub">${E(patientSub)}</div>` : ''}
      ${patient.chip ? `<div class="sub">Puce : ${E(patient.chip)}</div>` : ''}
    </div>
    <div>
      <div class="label">Propriétaire</div>
      <div class="name">${E(patient.owner || 'Non précisé')}</div>
      ${patient.phone ? `<div class="sub">Tél : ${E(patient.phone)}</div>` : ''}
    </div>
  </div>

  ${soapSection('S', soap.S)}
  ${soapSection('O', soap.O)}
  ${soapSection('A', soap.A)}
  ${soapSection('P', soap.P)}

  ${ownerSummary && String(ownerSummary).trim() ? `
    <div class="owner-summary">
      <div class="owner-summary-head">
        <span class="owner-summary-ic">✉</span>
        <span class="owner-summary-title">Résumé pour le propriétaire</span>
      </div>
      <div class="owner-summary-body">
        <p>${E(ownerSalutation)} ${E(patient.owner || 'Madame, Monsieur')},</p>
        <p>${E(ownerSummary).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>
        <p style="margin-top:10px;">Cordialement,<br/><strong>${E(vet || 'Dr. Jean Martin')}</strong></p>
      </div>
    </div>
  ` : ''}

  <div class="signature">
    <div>
      <div class="label">Vétérinaire</div>
      <div class="vet-name">${E(vet || 'Dr. Jean Martin')}</div>
      <div class="vet-info">N° Ordre : ${E(ordreNum || '75-12345')}</div>
      <div class="vet-info">${E(CLINIC.fullName)}</div>
    </div>
    <div class="sig-area">
      <div class="label">Cachet et signature</div>
      <div class="dot">Signature manuscrite du vétérinaire</div>
    </div>
  </div>

  <div class="disclaimer">
    <strong>Document professionnel</strong>
    Compte rendu rédigé avec l'aide de l'IA, vérifié et validé par le praticien. Le vétérinaire signataire reste seul responsable du contenu clinique de ce document. Conserver dans le dossier médical du patient.
  </div>

</body></html>`;
}

module.exports = { render, footerTemplate: pageFooterTemplate };
