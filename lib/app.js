const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { ANIMALS, APTS, NOTIFS, INVOICES } = require('./data');
const claude = require('./claude');
const openai = require('./openai');
const gemini = require('./gemini');
const pdfGen = require('./pdf-generator');
const pdf = require('./pdf'); // for safeFilenamePart + formatDateForFilename

// Try `primary` first; if it throws, log a warning and try `fallback`.
// `route` is the request path (e.g. "/api/diagnostic") used to make the logs
// easier to filter. Returns { result, modelUsed }. If both fail, throws an
// Error with both inner errors attached.
async function tryWithFallback({ route, primaryFn, primaryLabel, fallbackFn, fallbackLabel }) {
  const t0 = Date.now();
  try {
    const result = await primaryFn();
    console.log(`[ai] ${route} → ${primaryLabel} OK (${Date.now() - t0}ms)`);
    return { result, modelUsed: primaryLabel };
  } catch (primaryErr) {
    const primaryMsg = (primaryErr && primaryErr.message) || String(primaryErr);
    console.warn(`[ai] ${route} → ${primaryLabel} FAILED (${primaryMsg}) — falling back to ${fallbackLabel}`);
    const t1 = Date.now();
    try {
      const result = await fallbackFn();
      console.log(`[ai] ${route} → ${fallbackLabel} OK fallback (${Date.now() - t1}ms ; total ${Date.now() - t0}ms)`);
      return { result, modelUsed: `${fallbackLabel} (fallback)` };
    } catch (fbErr) {
      console.error(`[ai] ${route} → ${fallbackLabel} ALSO FAILED (${(fbErr && fbErr.message) || fbErr})`);
      const wrapped = new Error(
        `Tous les providers IA ont échoué — primaire (${primaryLabel}) : ${primaryMsg} ; secours (${fallbackLabel}) : ${(fbErr && fbErr.message) || fbErr}`
      );
      wrapped.primaryErr = primaryErr;
      wrapped.fallbackErr = fbErr;
      throw wrapped;
    }
  }
}

const app = express();

app.use(cors());
// Limit set to 10 MB so /api/diagnostic/image can accept up to a 5 MB image
// (base64 expands by ~33%, so a 5 MB binary payload is ~6.7 MB on the wire).
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// --- Auth ---------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'email et password requis' });
  }
  res.json({
    ok: true,
    token: 'mock-jwt-' + Buffer.from(email).toString('base64'),
    user: {
      email,
      name: 'Dr. Martin',
      role: 'veterinarian',
      clinic: 'Clinique VetCopilot',
    },
  });
});

// --- Animals ------------------------------------------------------------
app.get('/api/animals', (_req, res) => {
  res.json({ ok: true, animals: ANIMALS });
});

app.get('/api/animals/:id', (req, res) => {
  const animal = ANIMALS.find(a => a.id === Number(req.params.id));
  if (!animal) return res.status(404).json({ ok: false, error: 'animal introuvable' });
  res.json({ ok: true, animal });
});

// --- Appointments -------------------------------------------------------
app.get('/api/appointments', (_req, res) => {
  res.json({ ok: true, appointments: APTS });
});

// --- Notifications / Invoices (bonus — same prototype data) ------------
app.get('/api/notifications', (_req, res) => {
  res.json({ ok: true, notifications: NOTIFS });
});

app.get('/api/invoices', (_req, res) => {
  res.json({ ok: true, invoices: INVOICES });
});

// --- Diagnostic (Claude Sonnet primary, GPT-4o fallback) ----------------
app.post('/api/diagnostic', async (req, res) => {
  const { animalId, symptoms, notes } = req.body || {};
  if (!symptoms && !notes) {
    return res.status(400).json({ ok: false, error: 'champ "symptoms" ou "notes" requis' });
  }

  const animal = animalId != null ? ANIMALS.find(a => a.id === Number(animalId)) : null;
  const userPrompt = buildDiagnosticPrompt(animal, symptoms, notes);

  try {
    const { result, modelUsed } = await tryWithFallback({
      route: '/api/diagnostic',
      primaryFn: () => claude.callClaudeJSON({ system: claude.DIAGNOSTIC_SYSTEM, userPrompt, maxTokens: 3000 }),
      primaryLabel: `anthropic/${claude.MODEL}`,
      fallbackFn: () => openai.callOpenAIJSON({ system: claude.DIAGNOSTIC_SYSTEM, userPrompt, maxTokens: 3000 }),
      fallbackLabel: `openai/${openai.MODEL}`,
    });
    res.json({
      ok: true,
      input: { animalId: animal?.id ?? null, symptoms: symptoms ?? '', notes: notes ?? '' },
      result: result.parsed,
      meta: { model: modelUsed, usage: result.usage },
    });
  } catch (err) {
    const { status, message } = claude.mapAnthropicError(err.fallbackErr || err);
    res.status(status).json({ ok: false, error: message });
  }
});

// --- Image diagnostic (Claude Vision) -----------------------------------
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB after base64 decode

app.post('/api/diagnostic/image', async (req, res) => {
  const { imageBase64, mediaType, category, animalId } = req.body || {};

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ ok: false, error: 'champ "imageBase64" requis (chaîne base64, avec ou sans préfixe data:URI)' });
  }
  if (!mediaType || !ALLOWED_IMAGE_TYPES.has(mediaType)) {
    return res.status(400).json({ ok: false, error: 'mediaType doit être image/jpeg, image/png, image/gif ou image/webp' });
  }
  // Strip optional `data:image/png;base64,` prefix if present.
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
  const decodedBytes = Buffer.byteLength(cleanBase64, 'base64');
  if (decodedBytes > MAX_IMAGE_BYTES) {
    const mb = Math.round((decodedBytes / 1024 / 1024) * 10) / 10;
    return res.status(413).json({ ok: false, error: `image trop volumineuse (${mb} MB) — limite 5 MB` });
  }
  if (decodedBytes < 1024) {
    return res.status(400).json({ ok: false, error: 'image trop petite ou base64 invalide' });
  }

  const animal = animalId != null ? ANIMALS.find(a => a.id === Number(animalId)) : null;
  const userText = buildImageDiagnosticPrompt(animal, category);

  try {
    const { result, modelUsed } = await tryWithFallback({
      route: '/api/diagnostic/image',
      primaryFn: () => gemini.callGeminiImageJSON({
        system: claude.IMAGE_DIAGNOSTIC_SYSTEM,
        userText, imageBase64: cleanBase64, mediaType, maxTokens: 3000,
      }),
      primaryLabel: `google/${gemini.MODEL}`,
      fallbackFn: () => openai.callOpenAIImageJSON({
        system: claude.IMAGE_DIAGNOSTIC_SYSTEM,
        userText, imageBase64: cleanBase64, mediaType, maxTokens: 3000,
      }),
      fallbackLabel: `openai/${openai.MODEL}`,
    });
    res.json({
      ok: true,
      input: { category: category ?? null, animalId: animal?.id ?? null, mediaType, imageBytes: decodedBytes },
      result: result.parsed,
      meta: { model: modelUsed, usage: result.usage },
    });
  } catch (err) {
    const { status, message } = claude.mapAnthropicError(err.fallbackErr || err);
    res.status(status).json({ ok: false, error: message });
  }
});

function buildImageDiagnosticPrompt(animal, category) {
  const lines = [];
  if (animal) {
    lines.push(`Patient : ${animal.nm} — ${animal.sp} (${animal.breed}, ${animal.age}, ${animal.sex}, ${animal.wt})`);
    if (animal.allergy && animal.allergy.length) lines.push(`Allergies connues : ${animal.allergy.join(', ')}`);
  } else {
    lines.push('Patient : non précisé');
  }
  lines.push(`Type d'examen indiqué par le clinicien : ${category || 'non précisé'}`);
  lines.push('');
  lines.push('Analyse l\'image jointe et fournis ton interprétation en JSON suivant la structure définie.');
  return lines.join('\n');
}

// --- SOAP (Claude Sonnet primary, GPT-4o fallback) ----------------------
app.post('/api/soap/generate', async (req, res) => {
  const { animalId, motif, examen, hypothese, traitement } = req.body || {};
  const animal = animalId != null ? ANIMALS.find(a => a.id === Number(animalId)) : null;
  const userPrompt = buildSoapPrompt(animal, { motif, examen, hypothese, traitement });

  try {
    const { result, modelUsed } = await tryWithFallback({
      route: '/api/soap/generate',
      primaryFn: () => claude.callClaudeJSON({ system: claude.SOAP_SYSTEM, userPrompt, maxTokens: 2500 }),
      primaryLabel: `anthropic/${claude.MODEL}`,
      fallbackFn: () => openai.callOpenAIJSON({ system: claude.SOAP_SYSTEM, userPrompt, maxTokens: 2500 }),
      fallbackLabel: `openai/${openai.MODEL}`,
    });
    res.json({
      ok: true,
      patient: animal
        ? { id: animal.id, nm: animal.nm, sp: animal.sp, owner: animal.owner }
        : null,
      generatedAt: new Date().toISOString(),
      soap: result.parsed.soap,
      ownerSummary: result.parsed.ownerSummary,
      meta: { model: modelUsed, usage: result.usage },
    });
  } catch (err) {
    const { status, message } = claude.mapAnthropicError(err.fallbackErr || err);
    res.status(status).json({ ok: false, error: message });
  }
});

function buildDiagnosticPrompt(animal, symptoms, notes) {
  const lines = [];
  if (animal) {
    lines.push(`Patient : ${animal.nm} — ${animal.sp} (${animal.breed}, ${animal.age}, ${animal.sex}, ${animal.wt})`);
    if (animal.allergy?.length) lines.push(`Allergies connues : ${animal.allergy.join(', ')}`);
    if (animal.hist?.length) {
      const hist = animal.hist.map(h => `${h.t} (${h.d})`).join(' ; ');
      lines.push(`Antécédents : ${hist}`);
    }
  } else {
    lines.push('Patient : non précisé');
  }
  lines.push(`Symptômes / motif : ${symptoms || '(non précisé)'}`);
  if (notes) lines.push(`Notes complémentaires : ${notes}`);
  lines.push('');
  lines.push('Fournis 3 hypothèses diagnostiques en JSON suivant la structure définie.');
  return lines.join('\n');
}

function buildSoapPrompt(animal, { motif, examen, hypothese, traitement }) {
  const lines = [];
  if (animal) {
    lines.push(`Patient : ${animal.nm} (${animal.sp}, ${animal.breed}, ${animal.age}, ${animal.wt}) — propriétaire : ${animal.owner}`);
    if (animal.allergy?.length) lines.push(`Allergies : ${animal.allergy.join(', ')}`);
    if (animal.hist?.length) {
      const hist = animal.hist.map(h => `${h.t} (${h.d})`).join(' ; ');
      lines.push(`Antécédents : ${hist}`);
    }
  } else {
    lines.push('Patient : non précisé');
  }
  lines.push(`Motif de consultation : ${motif || '(non précisé)'}`);
  lines.push(`Examen clinique : ${examen || '(à compléter — générer un examen plausible)'}`);
  lines.push(`Hypothèse(s) principale(s) : ${hypothese || '(à proposer à partir du motif)'}`);
  lines.push(`Plan thérapeutique envisagé : ${traitement || '(à proposer)'}`);
  lines.push('');
  lines.push('Génère le SOAP complet + la version simplifiée pour le propriétaire en JSON.');
  return lines.join('\n');
}

// --- Ordonnance (Claude-powered) ----------------------------------------
app.post('/api/ordonnance/generate', async (req, res) => {
  const { animalId, animal: animalInline, diagnostic, symptoms } = req.body || {};

  let animal = animalId != null ? ANIMALS.find(a => a.id === Number(animalId)) : null;
  if (!animal && animalInline && animalInline.nm) animal = animalInline;

  if (!animal || !animal.nm) {
    return res.status(400).json({ ok: false, error: 'animal requis (animalId ou objet avec nm/sp/wt)' });
  }
  if (!diagnostic && !symptoms) {
    return res.status(400).json({ ok: false, error: 'diagnostic ou symptoms requis' });
  }

  const userPrompt = claude.buildOrdonnancePrompt(animal, diagnostic, symptoms);

  try {
    const { result, modelUsed } = await tryWithFallback({
      route: '/api/ordonnance/generate',
      primaryFn: () => claude.callClaudeOrdonnance({ animal, diagnostic, symptoms }),
      primaryLabel: `anthropic/${claude.MODEL}`,
      fallbackFn: () => openai.callOpenAIJSON({ system: claude.ORDONNANCE_SYSTEM, userPrompt, maxTokens: 2500 }),
      fallbackLabel: `openai/${openai.MODEL}`,
    });
    res.json({
      ok: true,
      patient: {
        nm: animal.nm, sp: animal.sp, breed: animal.breed,
        age: animal.age, sex: animal.sex, wt: animal.wt,
        owner: animal.owner, phone: animal.phone, chip: animal.chip,
        allergy: animal.allergy || [],
      },
      result: result.parsed,
      generatedAt: new Date().toISOString(),
      meta: { model: modelUsed, usage: result.usage },
    });
  } catch (err) {
    const { status, message } = claude.mapAnthropicError(err.fallbackErr || err);
    res.status(status).json({ ok: false, error: message });
  }
});

// --- Chatbot (Claude-powered, with clinic context) ----------------------
const MAX_CHAT_HISTORY = 20;

app.post('/api/chat', async (req, res) => {
  const { message, history, animalId } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'champ "message" requis (texte non vide)' });
  }

  // Sanitize history: keep only valid user/assistant turns, cap length, drop the
  // tail if the client accidentally includes the current message there too.
  const safeHistory = Array.isArray(history)
    ? history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content }))
    : [];

  const messages = [...safeHistory, { role: 'user', content: message }].slice(-MAX_CHAT_HISTORY);
  const animal = animalId != null ? ANIMALS.find(a => a.id === Number(animalId)) : null;
  const system = claude.buildChatSystem({ animals: ANIMALS, appointments: APTS, animal });
  // Chat fallback uses gpt-4o-mini — chat questions don't justify gpt-4o's cost,
  // and mini gives us a cheap safety net when Gemini hits its quota.
  const CHAT_FALLBACK_MODEL = 'gpt-4o-mini';

  try {
    const { result, modelUsed } = await tryWithFallback({
      route: '/api/chat',
      primaryFn: () => gemini.callGeminiChat({ messages, system, maxTokens: 1500 }),
      primaryLabel: `google/${gemini.MODEL}`,
      fallbackFn: () => openai.callOpenAIChat({ system, messages, maxTokens: 1500, model: CHAT_FALLBACK_MODEL }),
      fallbackLabel: `openai/${CHAT_FALLBACK_MODEL}`,
    });
    res.json({ ok: true, reply: result.text, meta: { model: modelUsed, usage: result.usage } });
  } catch (err) {
    const { status, message: errMsg } = claude.mapAnthropicError(err.fallbackErr || err);
    res.status(status).json({ ok: false, error: errMsg });
  }
});

// --- PDF exports --------------------------------------------------------
// SOAP report → PDF
// SOAP report → PDF (pdfkit)
app.post('/api/soap/export-pdf', async (req, res) => {
  const { patient, soap, vet, ownerSummary, date } = req.body || {};
  if (!soap || typeof soap !== 'object') {
    return res.status(400).json({ ok: false, error: 'champ "soap" requis (objet avec clés S, O, A, P)' });
  }
  const p = patient || {};
  const filename = `CR_${pdf.safeFilenamePart(p.nm || 'patient')}_${pdf.formatDateForFilename(new Date())}.pdf`;
  try {
    const buf = await pdfGen.generateSoapPdf({ patient: p, soap, vet, ownerSummary, date });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    console.error('[/api/soap/export-pdf] failed:', err.message || err);
    res.status(500).json({ ok: false, error: `Génération PDF échouée : ${err.message || err}` });
  }
});

// Diagnostic results → PDF (pdfkit)
app.post('/api/diagnostic/export-pdf', async (req, res) => {
  const { patient, symptoms, result, date, vet } = req.body || {};
  if (!result || !Array.isArray(result.hypotheses)) {
    return res.status(400).json({ ok: false, error: 'champ "result" requis (objet avec hypotheses[])' });
  }
  const p = patient || {};
  const filename = `Diagnostic_${pdf.safeFilenamePart(p.nm || 'patient')}_${pdf.formatDateForFilename(new Date())}.pdf`;
  try {
    const buf = await pdfGen.generateDiagnosticPdf({ patient: p, symptoms, result, date, vet });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    console.error('[/api/diagnostic/export-pdf] failed:', err.message || err);
    res.status(500).json({ ok: false, error: `Génération PDF échouée : ${err.message || err}` });
  }
});

// Ordonnance → PDF (pdfkit)
app.post('/api/ordonnance/export-pdf', async (req, res) => {
  const { patient, clinique = [], pharmacie = [], alerteAllergies = [], diagnostic, ordonnanceNum, date, vet } = req.body || {};
  if (!patient || !patient.nm) {
    return res.status(400).json({ ok: false, error: 'patient requis (objet avec nm)' });
  }
  if (!Array.isArray(clinique) || !Array.isArray(pharmacie) || (clinique.length + pharmacie.length === 0)) {
    return res.status(400).json({ ok: false, error: 'au moins un médicament requis (clinique ou pharmacie)' });
  }
  const filename = `Ordonnance_${pdf.safeFilenamePart(patient.nm)}_${pdf.formatDateForFilename(new Date())}.pdf`;
  try {
    const buf = await pdfGen.generateOrdonnancePdf({
      patient, clinique, pharmacie, alerteAllergies, diagnostic, ordonnanceNum, date, vet,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    console.error('[/api/ordonnance/export-pdf] failed:', err.message || err);
    res.status(500).json({ ok: false, error: `Génération PDF échouée : ${err.message || err}` });
  }
});

// --- Invoices -----------------------------------------------------------
// In-memory mutable copy so PATCH/POST on the status sticks for the session
// without rewriting the source data file.
const INVOICES_STATE = INVOICES.map(i => ({ ...i, actes: (i.actes || []).map(a => ({ ...a })) }));

app.get('/api/invoices', (_req, res) => {
  res.json({ ok: true, invoices: INVOICES_STATE });
});

app.post('/api/invoices/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const inv = INVOICES_STATE.find(i => i.id === id);
  if (!inv) return res.status(404).json({ ok: false, error: 'facture introuvable' });
  const allowed = ['paid', 'pending', 'overdue'];
  let next;
  if (status && allowed.includes(status)) {
    next = status;
  } else {
    // Toggle paid <-> pending
    next = inv.status === 'paid' ? 'pending' : 'paid';
  }
  inv.status = next;
  res.json({ ok: true, invoice: inv });
});

app.post('/api/invoices/:id/export-pdf', async (req, res) => {
  const { id } = req.params;
  const inv = INVOICES_STATE.find(i => i.id === id);
  if (!inv) return res.status(404).json({ ok: false, error: 'facture introuvable' });
  const animal = inv.animalId != null ? ANIMALS.find(a => a.id === Number(inv.animalId)) : null;
  const filename = `Facture_${pdf.safeFilenamePart(inv.id)}_${pdf.safeFilenamePart(inv.animal || 'patient')}.pdf`;
  try {
    const buf = await pdfGen.generateInvoicePdf({
      ...inv,
      patient: animal ? {
        nm: animal.nm, sp: animal.sp, breed: animal.breed,
        age: animal.age, sex: animal.sex, wt: animal.wt, phone: animal.phone,
      } : { nm: inv.animal },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    console.error('[/api/invoices/:id/export-pdf] failed:', err.message || err);
    res.status(500).json({ ok: false, error: `Génération PDF échouée : ${err.message || err}` });
  }
});

// --- Owner photo upload links -------------------------------------------
//
// Flow:
//   1. Vet calls POST /api/animals/:id/photo-link → backend mints a token,
//      stores { token, animalId, createdAt, used: false }, returns a path.
//   2. Vet shares /photo-upload/:token by SMS/WhatsApp/clipboard to the owner.
//   3. Owner opens the link on their phone → GET /photo-upload/:token serves
//      a standalone mobile-first page (no SPA, no login).
//   4. Owner POSTs the (client-side-resized) data URL → backend stores it on
//      ANIMAL_PHOTOS by animalId and flips the link's `used` flag.
//   5. Frontend on AnimalDetail fetches /api/animals/:id/photo to surface it.
//
// In-memory only — restarts wipe links + photos. Migrate to Supabase Storage
// once real persistence is needed.
const PHOTO_LINKS = new Map();   // token -> { token, animalId, createdAt, used }
const ANIMAL_PHOTOS = new Map(); // animalId (number) -> { dataUrl, mime, uploadedAt }
const PHOTO_LINK_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;       // hard cap on raw data URL length

function isLinkActive(link) {
  if (!link) return false;
  return Date.now() - link.createdAt < PHOTO_LINK_TTL_MS;
}

function findAnimal(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  return ANIMALS.find(a => a.id === n) || null;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Generate a fresh photo-upload link for the given animal.
app.post('/api/animals/:id/photo-link', (req, res) => {
  const animal = findAnimal(req.params.id);
  if (!animal) return res.status(404).json({ ok: false, error: 'animal introuvable' });
  const token = crypto.randomUUID();
  const link = { token, animalId: animal.id, createdAt: Date.now(), used: false };
  PHOTO_LINKS.set(token, link);
  res.json({
    ok: true,
    token,
    path: `/photo-upload/${token}`,
    expiresAt: new Date(link.createdAt + PHOTO_LINK_TTL_MS).toISOString(),
    animal: { id: animal.id, nm: animal.nm },
  });
});

// Owner-facing landing page — standalone HTML, no SPA, no auth.
app.get('/photo-upload/:token', (req, res) => {
  const link = PHOTO_LINKS.get(req.params.token);
  const expired = !link || !isLinkActive(link);
  const animal = link ? findAnimal(link.animalId) : null;
  const animalNm = escapeHtml(animal ? animal.nm : 'votre animal');
  const token = escapeHtml(req.params.token);

  if (expired || !animal) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(410).end(renderPhotoUploadPage({ state: 'expired', animalNm, token }));
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderPhotoUploadPage({
    state: link.used ? 'used' : 'ready',
    animalNm, token,
  }));
});

// Owner submits the (client-side-resized) data URL.
app.post('/photo-upload/:token', (req, res) => {
  const link = PHOTO_LINKS.get(req.params.token);
  if (!link) return res.status(404).json({ ok: false, error: 'lien invalide' });
  if (!isLinkActive(link)) return res.status(410).json({ ok: false, error: 'lien expiré' });
  if (link.used) return res.status(409).json({ ok: false, error: 'lien déjà utilisé' });

  const { image } = req.body || {};
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ ok: false, error: 'image manquante ou format invalide' });
  }
  if (image.length > PHOTO_MAX_BYTES) {
    return res.status(413).json({ ok: false, error: 'image trop volumineuse' });
  }
  const mimeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(image);
  if (!mimeMatch) return res.status(400).json({ ok: false, error: 'data URL invalide' });

  ANIMAL_PHOTOS.set(link.animalId, {
    dataUrl: image,
    mime: mimeMatch[1],
    uploadedAt: Date.now(),
  });
  link.used = true;
  res.json({ ok: true, message: 'Photo envoyée avec succès' });
});

// Vet UI polls this to surface a freshly uploaded photo on the animal sheet.
app.get('/api/animals/:id/photo', (req, res) => {
  const animal = findAnimal(req.params.id);
  if (!animal) return res.status(404).json({ ok: false, error: 'animal introuvable' });
  const photo = ANIMAL_PHOTOS.get(animal.id);
  if (!photo) return res.json({ ok: true, photo: null });
  res.json({
    ok: true,
    photo: { dataUrl: photo.dataUrl, mime: photo.mime, uploadedAt: photo.uploadedAt },
  });
});

// Standalone owner-facing HTML page.
function renderPhotoUploadPage({ state, animalNm, token }) {
  const expiredCard = state === 'expired' ? `
    <div class="state state-bad">
      <div class="ico">⏰</div>
      <h2>Lien expiré</h2>
      <p>Ce lien a expiré ou n'est plus valide. Contactez la clinique pour en obtenir un nouveau.</p>
    </div>` : '';
  const usedCard = state === 'used' ? `
    <div class="state state-ok">
      <div class="ico">✅</div>
      <h2>Photo déjà reçue</h2>
      <p>Merci, la photo de ${animalNm} a bien été transmise à la clinique.</p>
    </div>` : '';
  const readyForm = state === 'ready' ? `
    <p class="lead">La clinique <strong>VetCopilot</strong> vous demande une photo de <strong>${animalNm}</strong> afin de l'ajouter à son dossier médical.</p>
    <label class="pickBtn" id="pickBtn">
      <span class="ico">📷</span>
      <span class="lbl">Prendre une photo</span>
      <span class="sub">ou en choisir une dans la galerie</span>
      <input type="file" id="file" accept="image/*" capture="environment" hidden>
    </label>
    <div id="previewWrap" hidden>
      <img id="preview" alt="Aperçu">
      <div class="row">
        <button type="button" class="btn btn-ghost" id="retake">Reprendre</button>
        <button type="button" class="btn btn-primary" id="send">Envoyer la photo</button>
      </div>
    </div>
    <div id="status" class="status" hidden></div>
    <div id="success" class="state state-ok" hidden>
      <div class="ico">✅</div>
      <h2>Merci !</h2>
      <p>La photo de ${animalNm} a bien été envoyée à la clinique.</p>
    </div>` : '';

  // Client-side resize + POST. Mobile-first CSS, navy/teal palette.
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0B1D34">
<title>VetCopilot — Photo de ${animalNm}</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(180deg,#f5f8fb 0%,#e8edf2 100%);min-height:100vh;color:#1a2230;-webkit-font-smoothing:antialiased}
  .wrap{max-width:480px;margin:0 auto;padding:24px 18px 40px;min-height:100vh;display:flex;flex-direction:column}
  header{display:flex;align-items:center;gap:12px;margin-bottom:24px}
  .logo{width:48px;height:48px;border-radius:12px;background:#0B1D34;position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .logo svg{width:36px;height:36px}
  .brand{font-weight:700;font-size:1.15rem;color:#0B1D34;letter-spacing:-0.01em}
  .brand small{display:block;font-weight:400;font-size:.75rem;color:#5a6470;letter-spacing:0}
  .card{background:#fff;border-radius:18px;padding:24px;box-shadow:0 4px 20px rgba(11,29,52,.06);flex:1}
  .lead{font-size:1rem;line-height:1.5;color:#1a2230;margin:0 0 24px}
  .lead strong{color:#0B1D34}
  .pickBtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:36px 20px;border:2px dashed #2BA08F;border-radius:14px;background:rgba(43,160,143,.04);cursor:pointer;transition:all .15s;text-align:center}
  .pickBtn:active{background:rgba(43,160,143,.1);transform:scale(.98)}
  .pickBtn .ico{font-size:2.6rem;line-height:1}
  .pickBtn .lbl{font-weight:600;color:#0B1D34;font-size:1.05rem}
  .pickBtn .sub{font-size:.82rem;color:#5a6470}
  #previewWrap{margin-top:6px}
  #preview{width:100%;border-radius:14px;display:block;background:#0B1D34}
  .row{display:flex;gap:10px;margin-top:14px}
  .btn{flex:1;padding:14px 16px;border-radius:12px;border:none;font-size:1rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit}
  .btn:active{transform:scale(.97)}
  .btn-primary{background:#2BA08F;color:#fff}
  .btn-primary:disabled{background:#9bbab4;cursor:not-allowed}
  .btn-ghost{background:#f0f3f6;color:#0B1D34}
  .status{margin-top:14px;padding:12px;border-radius:10px;font-size:.9rem;text-align:center}
  .status.err{background:#fdecec;color:#c0392b}
  .status.info{background:rgba(43,160,143,.08);color:#0B1D34}
  .state{text-align:center;padding:30px 16px}
  .state .ico{font-size:3.4rem;margin-bottom:10px}
  .state h2{margin:0 0 8px;color:#0B1D34}
  .state p{margin:0;color:#5a6470;line-height:1.5}
  footer{margin-top:24px;text-align:center;font-size:.72rem;color:#8a909a}
  @media (max-width:380px){.card{padding:18px}.pickBtn{padding:28px 14px}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">
      <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 14 L21 14 L28 36 L35 14 L44 14 L28 48 Z" fill="#fff"/>
        <rect x="41.5" y="9" width="3" height="13" rx="0.5" fill="#C8A45C"/>
        <rect x="36.5" y="14" width="13" height="3" rx="0.5" fill="#C8A45C"/>
      </svg>
    </div>
    <div class="brand">VetCopilot<small>Clinique Vétérinaire</small></div>
  </header>
  <div class="card">
    ${expiredCard}${usedCard}${readyForm}
  </div>
  <footer>Lien sécurisé · Photo envoyée uniquement à votre vétérinaire</footer>
</div>
${state === 'ready' ? `
<script>
(function(){
  var fileInput = document.getElementById('file');
  var pickBtn = document.getElementById('pickBtn');
  var previewWrap = document.getElementById('previewWrap');
  var previewImg = document.getElementById('preview');
  var sendBtn = document.getElementById('send');
  var retakeBtn = document.getElementById('retake');
  var statusEl = document.getElementById('status');
  var successEl = document.getElementById('success');
  var dataUrl = null;

  function showStatus(msg, kind){
    statusEl.textContent = msg;
    statusEl.className = 'status ' + (kind || 'info');
    statusEl.hidden = false;
  }
  function hideStatus(){ statusEl.hidden = true; }

  // Resize via canvas — keeps payload reasonable on slow mobile connections.
  function resizeImage(file, maxDim, quality){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onerror = function(){ reject(new Error('Lecture du fichier impossible')); };
      reader.onload = function(){
        var img = new Image();
        img.onerror = function(){ reject(new Error('Image illisible')); };
        img.onload = function(){
          var w = img.width, h = img.height;
          if (w > maxDim || h > maxDim){
            var ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  fileInput.addEventListener('change', function(){
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    hideStatus();
    showStatus('Préparation de la photo...', 'info');
    resizeImage(f, 1400, 0.85).then(function(url){
      dataUrl = url;
      previewImg.src = url;
      previewWrap.hidden = false;
      pickBtn.style.display = 'none';
      hideStatus();
    }).catch(function(err){
      showStatus(err.message || 'Erreur', 'err');
    });
  });

  retakeBtn.addEventListener('click', function(){
    dataUrl = null;
    fileInput.value = '';
    previewWrap.hidden = true;
    pickBtn.style.display = '';
    hideStatus();
  });

  sendBtn.addEventListener('click', function(){
    if (!dataUrl) return;
    sendBtn.disabled = true;
    retakeBtn.disabled = true;
    showStatus('Envoi en cours...', 'info');
    fetch(location.pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    }).then(function(r){ return r.json().then(function(d){ return { status: r.status, body: d }; }); })
      .then(function(res){
        if (res.body && res.body.ok){
          previewWrap.hidden = true;
          pickBtn.style.display = 'none';
          hideStatus();
          successEl.hidden = false;
        } else {
          sendBtn.disabled = false; retakeBtn.disabled = false;
          showStatus((res.body && res.body.error) || 'Erreur lors de l\\'envoi', 'err');
        }
      })
      .catch(function(err){
        sendBtn.disabled = false; retakeBtn.disabled = false;
        showStatus('Connexion impossible — réessayez', 'err');
      });
  });
})();
</script>` : ''}
</body>
</html>`;
}

// --- 404 for unknown /api/* --------------------------------------------
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'route API inconnue' });
});

module.exports = app;
