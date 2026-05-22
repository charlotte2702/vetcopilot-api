const {
  escapeHtml, formatDate, CLINIC, LOGO_SVG, baseStyles, pageFooterTemplate,
} = require('./_common');
const E = escapeHtml;

const URGENCY_COLORS = {
  faible:   { bg: '#dcfce7', text: '#166534', border: '#86efac', accent: '#16a34a' },
  moderee:  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74', accent: '#ea580c' },
  elevee:   { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', accent: '#dc2626' },
  critique: { bg: '#fee2e2', text: '#7f1d1d', border: '#f87171', accent: '#991b1b' },
};

function hypothesisCard(h, i) {
  const lv = h.lv || 'lo';
  const prob = Math.max(0, Math.min(100, Number(h.prob) || 0));
  const gradient = {
    hi: 'linear-gradient(90deg, #ea580c, #f97316)',
    md: 'linear-gradient(90deg, #2BA08F, #3dcfb6)',
    lo: 'linear-gradient(90deg, #2BA08F, #5ec5b1)',
  }[lv] || 'linear-gradient(90deg, #2BA08F, #5ec5b1)';
  const probColor = lv === 'hi' ? '#ea580c' : '#2BA08F';

  return `<div class="hypo-card">
    <div class="hypo-head">
      <span class="hypo-num">${i + 1}</span>
      <span class="hypo-name">${E(h.nm || 'Hypothèse')}</span>
      ${prob > 0 ? `<span class="hypo-prob" style="color:${probColor};">${prob}%</span>` : ''}
    </div>
    ${prob > 0 ? `<div class="hypo-bar"><div class="hypo-bar-fill" style="width:${prob}%;background:${gradient};"></div></div>` : ''}
    ${h.desc ? `<div class="hypo-desc">${E(h.desc)}</div>` : ''}
    ${Array.isArray(h.exams) && h.exams.length ? `<div class="hypo-exams">
      <div class="hypo-exams-title">Examens conseillés</div>
      <ul>${h.exams.map(e => `<li>${E(e)}</li>`).join('')}</ul>
    </div>` : ''}
  </div>`;
}

function render(data) {
  const {
    patient = {}, symptoms, result = {}, date, vet, ordreNum, ordonnanceNum,
  } = data;
  const dateStr = date || formatDate();
  const ref = ordonnanceNum || `DIAG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const urgency = (result.urgency || 'faible').toLowerCase();
  const urgencyLabel = result.urgencyLabel || urgency.toUpperCase();
  const urgColors = URGENCY_COLORS[urgency] || URGENCY_COLORS.faible;
  const hypotheses = Array.isArray(result.hypotheses) ? result.hypotheses : [];

  const patientName = `${patient.nm || 'Patient'}${patient.sp ? ' — ' + patient.sp : ''}${patient.breed ? ' (' + patient.breed + ')' : ''}`;
  const patientSub = [patient.age, patient.sex, patient.wt].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Aide au diagnostic — ${E(patient.nm || '')}</title>
<style>${baseStyles()}
  .symptoms-block { background: #f7f8fa; border-left: 4px solid #2BA08F; border-radius: 8px; padding: 12px 16px; margin: 14px 0; font-style: italic; color: #1a2230; font-size: 9.5pt; line-height: 1.55; }
  .symptoms-block .label { font-style: normal; font-size: 7pt; font-weight: 800; color: #8a909a; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 4px; }

  .urgency-badge { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-radius: 12px; margin: 18px 0 14px; background: ${urgColors.bg}; border: 1px solid ${urgColors.border}; border-left: 6px solid ${urgColors.accent}; }
  .urgency-badge .ic { width: 36px; height: 36px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-size: 16pt; color: ${urgColors.accent}; flex-shrink: 0; font-weight: 800; }
  .urgency-badge .text { color: ${urgColors.text}; }
  .urgency-badge .text .label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.85; }
  .urgency-badge .text .value { font-size: 14pt; font-weight: 800; letter-spacing: 0.02em; }

  .hypotheses-title { font-size: 13pt; font-weight: 800; color: #0B1D34; margin: 20px 0 12px; display: flex; align-items: center; gap: 8px; }
  .hypotheses-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #2BA08F; border-radius: 2px; }

  .hypo-card { background: white; border: 1px solid #e9ecf1; border-radius: 10px; padding: 14px 18px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(11,29,52,0.04); page-break-inside: avoid; }
  .hypo-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .hypo-num { width: 24px; height: 24px; border-radius: 50%; background: #0B1D34; color: white; font-weight: 800; font-size: 10pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .hypo-name { flex: 1; font-size: 11.5pt; font-weight: 700; color: #0B1D34; line-height: 1.3; }
  .hypo-prob { font-size: 14pt; font-weight: 800; flex-shrink: 0; }
  .hypo-bar { height: 6px; background: #e9ecf1; border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
  .hypo-bar-fill { height: 100%; border-radius: 3px; }
  .hypo-desc { font-size: 9.5pt; color: #5a6470; line-height: 1.55; font-style: italic; margin-bottom: 10px; }
  .hypo-exams { background: rgba(43,160,143,0.05); border-radius: 8px; padding: 10px 14px; }
  .hypo-exams-title { font-size: 7.5pt; font-weight: 800; color: #2BA08F; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
  .hypo-exams ul { list-style: none; }
  .hypo-exams li { font-size: 9pt; color: #1a2230; padding: 2px 0 2px 14px; position: relative; line-height: 1.45; }
  .hypo-exams li::before { content: '•'; position: absolute; left: 2px; color: #2BA08F; font-weight: 800; }
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

  <div class="doc-title">Aide au diagnostic</div>
  <div class="doc-subtitle">Analyse IA des symptômes — Document d'aide à la décision</div>

  <div class="patient-block">
    <div>
      <div class="label">Patient</div>
      <div class="name">${E(patientName)}</div>
      ${patientSub ? `<div class="sub">${E(patientSub)}</div>` : ''}
    </div>
    <div>
      <div class="label">Propriétaire</div>
      <div class="name">${E(patient.owner || 'Non précisé')}</div>
      ${patient.phone ? `<div class="sub">Tél : ${E(patient.phone)}</div>` : ''}
    </div>
  </div>

  ${symptoms ? `<div class="symptoms-block">
    <div class="label">Symptômes rapportés</div>
    ${E(symptoms)}
  </div>` : ''}

  <div class="urgency-badge">
    <span class="ic">!</span>
    <div class="text">
      <div class="label">Niveau d'urgence estimé</div>
      <div class="value">${E(urgencyLabel)}</div>
    </div>
  </div>

  <div class="hypotheses-title">Hypothèses diagnostiques</div>
  ${hypotheses.length
    ? hypotheses.map(hypothesisCard).join('')
    : '<div style="color:#8a909a;font-style:italic;padding:10px 0;">Aucune hypothèse retournée.</div>'
  }

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
    <strong>Avertissement</strong>
    Cette analyse est générée par IA à titre indicatif. Elle ne remplace en aucun cas l'examen clinique, les examens complémentaires et le jugement professionnel du vétérinaire. Le praticien reste seul responsable du diagnostic final et de la conduite thérapeutique.
  </div>

</body></html>`;
}

module.exports = { render, footerTemplate: pageFooterTemplate };
