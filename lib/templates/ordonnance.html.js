const {
  escapeHtml, formatDate, CLINIC, LOGO_SVG, baseStyles, pageFooterTemplate,
} = require('./_common');
const E = escapeHtml;

function medCard(m, num, withCheckbox) {
  const hasForme = m.forme && String(m.forme).trim();
  const hasRemarks = m.remarques && String(m.remarques).trim();
  const doseParts = [];
  if (m.dose_par_kg)   doseParts.push(`Posologie : ${E(m.dose_par_kg)}`);
  if (m.dose_calculee) doseParts.push(`Dose : <strong>${E(m.dose_calculee)}</strong>`);
  const admParts = [];
  if (m.voie)      admParts.push(`<span class="adm-key">Voie</span> ${E(m.voie)}`);
  if (m.frequence) admParts.push(`<span class="adm-key">Fréquence</span> ${E(m.frequence)}`);
  if (m.duree)     admParts.push(`<span class="adm-key">Durée</span> ${E(m.duree)}`);

  return `<div class="med-card">
    <div class="med-rail">
      ${withCheckbox ? '<span class="med-checkbox" aria-label="Remis ce jour"></span>' : ''}
      <span class="med-num">${num}</span>
    </div>
    <div class="med-body">
      <div class="med-name-line">
        <span class="med-name">${E(m.nm || 'Médicament')}</span>
        ${m.dci ? `<span class="med-dci">— ${E(m.dci)}</span>` : ''}
      </div>
      ${hasForme ? `<div class="med-forme">${E(m.forme)}</div>` : ''}
      <div class="med-divider"></div>
      ${doseParts.length ? `<div class="med-dose">${doseParts.join('   ·   ')}</div>` : ''}
      ${admParts.length ? `<div class="med-adm">${admParts.join('  <span class="adm-sep">|</span>  ')}</div>` : ''}
      ${hasRemarks ? `<div class="med-remarks">${E(m.remarques)}</div>` : ''}
    </div>
  </div>`;
}

function alertBox(alerts) {
  if (!alerts || !alerts.length) return '';
  return `<div class="alert">
    <div class="alert-title">Alertes allergies &amp; contre-indications</div>
    <ul>${alerts.map(a => `<li>${E(a)}</li>`).join('')}</ul>
  </div>`;
}

function render(data) {
  const {
    patient = {}, diagnostic, clinique = [], pharmacie = [],
    alerteAllergies = [], ordonnanceNum, date, vet, ordreNum,
  } = data;
  const num = ordonnanceNum || `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const dateStr = date || formatDate();
  const patientName = `${patient.nm || 'Patient'}${patient.sp ? ' — ' + patient.sp : ''}${patient.breed ? ' (' + patient.breed + ')' : ''}`;
  const patientSub = [patient.age, patient.sex, patient.wt].filter(Boolean).join(' · ');
  const ownerName = patient.owner || 'Propriétaire non précisé';
  const ownerSub = patient.phone || '';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Ordonnance ${E(num)}</title>
<style>${baseStyles()}
  .ord-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: linear-gradient(135deg, #f7f8fa, #eef1f5); border-radius: 10px; padding: 12px 18px; margin-bottom: 14px; border: 1px solid #e9ecf1; }
  .ord-meta .item .label { font-size: 7pt; font-weight: 800; color: #8a909a; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
  .ord-meta .item .value { font-size: 10pt; font-weight: 700; color: #0B1D34; }
  .ord-meta .item.diag { grid-column: 1 / -1; border-top: 1px solid #e0e4ea; padding-top: 8px; margin-top: 2px; }
  .ord-meta .item.diag .value { font-weight: 500; }

  .alert { background: #fef1f1; border: 1px solid #f0c4c4; border-left: 4px solid #dc2626; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
  .alert-title { font-size: 8pt; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 7px; }
  .alert ul { list-style: none; }
  .alert li { position: relative; padding-left: 14px; font-size: 9pt; line-height: 1.5; color: #1a2230; margin-bottom: 3px; }
  .alert li::before { content: '•'; color: #dc2626; font-weight: 700; position: absolute; left: 0; top: 0; }

  .section-hdr { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-radius: 10px; color: white; margin: 16px 0 12px; box-shadow: 0 2px 6px rgba(11,29,52,0.10); }
  .section-hdr.clinique { background: linear-gradient(135deg, #2BA08F, #1f8a76); }
  .section-hdr.pharmacie { background: linear-gradient(135deg, #0B1D34, #14304f); }
  .section-hdr .chip { width: 24px; height: 24px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11pt; flex-shrink: 0; }
  .section-hdr.clinique .chip { color: #2BA08F; }
  .section-hdr.pharmacie .chip { color: #0B1D34; }
  .section-hdr .title { font-size: 10.5pt; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; flex: 1; }
  .section-hdr .count { font-size: 8.5pt; opacity: 0.85; font-weight: 500; }

  .med-card { background: #fafbfc; border: 1px solid #e9ecf1; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: flex-start; page-break-inside: avoid; box-shadow: 0 1px 2px rgba(11,29,52,0.04); }
  .med-rail { display: flex; align-items: center; gap: 8px; padding-top: 1px; }
  .med-checkbox { width: 14px; height: 14px; border: 1.5px solid #0B1D34; border-radius: 3px; display: inline-block; }
  .med-num { width: 24px; height: 24px; border-radius: 50%; background: #2BA08F; color: white; font-weight: 800; font-size: 10.5pt; display: flex; align-items: center; justify-content: center; }
  .med-body .med-name-line { margin-bottom: 2px; }
  .med-name { font-size: 11.5pt; font-weight: 800; color: #0B1D34; text-transform: uppercase; letter-spacing: 0.01em; }
  .med-dci { font-style: italic; color: #5a6470; font-size: 10pt; margin-left: 4px; }
  .med-forme { font-size: 8.5pt; color: #5a6470; }
  .med-divider { height: 1px; background: #e9ecf1; margin: 8px 0; }
  .med-dose { font-size: 10pt; font-weight: 700; color: #2BA08F; margin-bottom: 5px; }
  .med-dose strong { color: #0B1D34; }
  .med-adm { font-size: 9.5pt; color: #1a2230; }
  .med-adm .adm-key { font-size: 7pt; font-weight: 800; color: #8a909a; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 3px; }
  .med-adm .adm-sep { color: #c8ced6; margin: 0 2px; }
  .med-remarks { font-size: 8.5pt; font-style: italic; color: #5a6470; margin-top: 6px; padding-left: 8px; border-left: 2px solid #e9ecf1; }
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
      <div class="ref">${E(num)}</div>
      <div>${E(dateStr)}</div>
    </div>
  </div>
  <div class="doc-header-thin"></div>

  <div class="doc-title">Ordonnance</div>

  <div class="ord-meta">
    <div class="item">
      <div class="label">N° Ordonnance</div>
      <div class="value">${E(num)}</div>
    </div>
    <div class="item" style="text-align:right;">
      <div class="label">Date d'émission</div>
      <div class="value">${E(dateStr)}</div>
    </div>
    ${diagnostic ? `<div class="item diag">
      <div class="label">Diagnostic</div>
      <div class="value">${E(diagnostic)}</div>
    </div>` : ''}
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
      <div class="name">${E(ownerName)}</div>
      ${ownerSub ? `<div class="sub">Tél : ${E(ownerSub)}</div>` : ''}
    </div>
  </div>

  ${alertBox(alerteAllergies)}

  ${clinique.length ? `
    <div class="section-hdr clinique">
      <span class="chip">+</span>
      <span class="title">🏥 Délivré par la clinique (à remettre ce jour)</span>
      <span class="count">${clinique.length} médicament${clinique.length > 1 ? 's' : ''}</span>
    </div>
    ${clinique.map((m, i) => medCard(m, i + 1, true)).join('')}
  ` : ''}

  ${pharmacie.length ? `
    <div class="section-hdr pharmacie">
      <span class="chip">℞</span>
      <span class="title">💊 À acheter en pharmacie</span>
      <span class="count">${pharmacie.length} médicament${pharmacie.length > 1 ? 's' : ''}</span>
    </div>
    ${pharmacie.map((m, i) => medCard(m, i + 1, false)).join('')}
  ` : ''}

  <div class="signature">
    <div>
      <div class="label">Vétérinaire prescripteur</div>
      <div class="vet-name">${E(vet || 'Dr. Jean Martin')}</div>
      <div class="vet-info">N° Ordre des Vétérinaires : ${E(ordreNum || '75-12345')}</div>
      <div class="vet-info">${E(CLINIC.fullName)}</div>
    </div>
    <div class="sig-area">
      <div class="label">Cachet et signature</div>
      <div class="dot">Signature manuscrite du vétérinaire</div>
    </div>
  </div>

  <div class="disclaimer">
    <strong>Avertissement</strong>
    Le vétérinaire prescripteur reste seul responsable de la prescription. Ordonnance valable 1 an pour la dispensation initiale, 6 mois pour le renouvellement. À usage vétérinaire exclusif. Conserver hors de portée des enfants et des animaux.
  </div>

</body></html>`;
}

module.exports = { render, footerTemplate: pageFooterTemplate };
