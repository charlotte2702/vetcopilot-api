// Shared helpers for the PDF HTML templates.

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(d = new Date()) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateLong(d = new Date()) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateForFilename(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeFilenamePart(s) {
  return String(s || 'inconnu')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'inconnu';
}

// Clinic identity — single source of truth for all templates.
const CLINIC = {
  name: 'VetCopilot',
  fullName: 'Clinique Vétérinaire VetCopilot',
  address: '15 rue de la Santé, 75013 Paris',
  phone: '01 23 45 67 89',
};

// "V+" wordmark — navy square with white V and gold cross. Used in every header.
const LOGO_SVG = `<svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
  <rect width="56" height="56" rx="12" fill="#0B1D34"/>
  <path d="M 12 14 L 21 14 L 28 36 L 35 14 L 44 14 L 28 48 Z" fill="white"/>
  <g fill="#C8A45C">
    <rect x="41.5" y="9" width="3" height="13" rx="1"/>
    <rect x="36.5" y="14" width="13" height="3" rx="1"/>
  </g>
</svg>`;

// Shared CSS — included in every template. Each template can add its own
// extra rules in a follow-up <style> block.
function baseStyles() {
  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10pt; line-height: 1.5; color: #1a2230;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    body { padding: 0; }

    /* HEADER */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding-bottom: 14px; margin-bottom: 6px; border-bottom: 2px solid #0B1D34; }
    .doc-header-left { display: flex; align-items: center; gap: 14px; }
    .doc-header-clinic { line-height: 1.2; }
    .doc-header-clinic h1 { font-size: 17pt; font-weight: 800; color: #0B1D34; letter-spacing: -0.01em; }
    .doc-header-clinic .sub { font-size: 8.5pt; color: #5a6470; margin-top: 4px; }
    .doc-header-meta { text-align: right; font-size: 8.5pt; color: #5a6470; line-height: 1.7; }
    .doc-header-meta .ref { color: #0B1D34; font-weight: 700; font-size: 9pt; }
    .doc-header-thin { height: 1px; background: #2BA08F; opacity: 0.6; margin-bottom: 18px; }

    /* TITLE */
    .doc-title { font-size: 22pt; font-weight: 800; letter-spacing: 0.14em; text-align: center; color: #0B1D34; text-transform: uppercase; margin: 6px 0 4px; }
    .doc-subtitle { font-size: 9.5pt; color: #5a6470; text-align: center; margin-bottom: 18px; }

    /* PATIENT BLOCK */
    .patient-block { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f7f8fa; border-radius: 10px; padding: 14px 18px; margin-bottom: 14px; border: 1px solid #e9ecf1; }
    .patient-block .label { font-size: 7pt; font-weight: 800; color: #8a909a; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; }
    .patient-block .name { font-size: 11.5pt; font-weight: 700; color: #0B1D34; }
    .patient-block .sub { font-size: 9pt; color: #5a6470; margin-top: 3px; }

    /* DISCLAIMER */
    .disclaimer { background: #fdf6e3; border: 1px solid #f0d59a; border-left: 4px solid #C8A45C; border-radius: 6px; padding: 11px 14px; margin-top: 14px; font-size: 8.5pt; color: #5a6470; line-height: 1.55; }
    .disclaimer strong { color: #C8A45C; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; font-size: 7.5pt; display: block; margin-bottom: 4px; }

    /* SIGNATURE */
    .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 22px; padding-top: 16px; border-top: 1px solid #e9ecf1; }
    .signature .label { font-size: 7pt; font-weight: 800; color: #8a909a; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
    .signature .vet-name { font-size: 11pt; font-weight: 700; color: #0B1D34; }
    .signature .vet-info { font-size: 8.5pt; color: #5a6470; margin-top: 3px; }
    .signature .sig-area { text-align: right; }
    .signature .sig-area .dot { border-top: 1.5px dotted #8a909a; margin-top: 46px; padding-top: 5px; font-size: 7pt; color: #8a909a; font-style: italic; }
  `;
}

// Standard footer that Puppeteer renders on every page. Variables to set:
// font sizes are inline because Puppeteer doesn't inherit from the body CSS.
function pageFooterTemplate() {
  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:7pt;color:#8a909a;width:100%;padding:0 14mm 0 14mm;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-style:italic;">Généré par VetCopilot — L'IA est un outil d'aide, le vétérinaire garde la décision finale.</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

module.exports = {
  escapeHtml, formatDate, formatDateLong, formatDateForFilename, safeFilenamePart,
  CLINIC, LOGO_SVG, baseStyles, pageFooterTemplate,
};
