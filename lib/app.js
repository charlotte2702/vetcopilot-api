const express = require('express');
const cors = require('cors');
const { ANIMALS, APTS, NOTIFS, INVOICES } = require('./data');
const claude = require('./claude');
const pdf = require('./pdf');

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

// --- Diagnostic (Claude-powered) ----------------------------------------
app.post('/api/diagnostic', async (req, res) => {
  const { animalId, symptoms, notes } = req.body || {};
  if (!symptoms && !notes) {
    return res.status(400).json({ ok: false, error: 'champ "symptoms" ou "notes" requis' });
  }

  const animal = animalId != null ? ANIMALS.find(a => a.id === Number(animalId)) : null;
  const userPrompt = buildDiagnosticPrompt(animal, symptoms, notes);

  try {
    const { parsed, usage } = await claude.callClaudeJSON({
      system: claude.DIAGNOSTIC_SYSTEM,
      userPrompt,
      maxTokens: 3000,
    });
    res.json({
      ok: true,
      input: { animalId: animal?.id ?? null, symptoms: symptoms ?? '', notes: notes ?? '' },
      result: parsed,
      meta: { model: claude.MODEL, usage },
    });
  } catch (err) {
    const { status, message } = claude.mapAnthropicError(err);
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
    const { parsed, usage } = await claude.callClaudeImageJSON({
      system: claude.IMAGE_DIAGNOSTIC_SYSTEM,
      userText,
      imageBase64: cleanBase64,
      mediaType,
      maxTokens: 3000,
    });
    res.json({
      ok: true,
      input: { category: category ?? null, animalId: animal?.id ?? null, mediaType, imageBytes: decodedBytes },
      result: parsed,
      meta: { model: claude.MODEL, usage },
    });
  } catch (err) {
    const { status, message } = claude.mapAnthropicError(err);
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

// --- SOAP (Claude-powered) ----------------------------------------------
app.post('/api/soap/generate', async (req, res) => {
  const { animalId, motif, examen, hypothese, traitement } = req.body || {};
  const animal = animalId != null ? ANIMALS.find(a => a.id === Number(animalId)) : null;
  const userPrompt = buildSoapPrompt(animal, { motif, examen, hypothese, traitement });

  try {
    const { parsed, usage } = await claude.callClaudeJSON({
      system: claude.SOAP_SYSTEM,
      userPrompt,
      maxTokens: 2500,
    });
    res.json({
      ok: true,
      patient: animal
        ? { id: animal.id, nm: animal.nm, sp: animal.sp, owner: animal.owner }
        : null,
      generatedAt: new Date().toISOString(),
      soap: parsed.soap,
      ownerSummary: parsed.ownerSummary,
      meta: { model: claude.MODEL, usage },
    });
  } catch (err) {
    const { status, message } = claude.mapAnthropicError(err);
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

  try {
    const { parsed, usage } = await claude.callClaudeOrdonnance({ animal, diagnostic, symptoms });
    res.json({
      ok: true,
      patient: {
        nm: animal.nm, sp: animal.sp, breed: animal.breed,
        age: animal.age, sex: animal.sex, wt: animal.wt,
        owner: animal.owner, phone: animal.phone, chip: animal.chip,
        allergy: animal.allergy || [],
      },
      result: parsed,
      generatedAt: new Date().toISOString(),
      meta: { model: claude.MODEL, usage },
    });
  } catch (err) {
    const { status, message } = claude.mapAnthropicError(err);
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

  try {
    const { text, usage } = await claude.callClaudeChat({
      messages,
      animals: ANIMALS,
      appointments: APTS,
      animal,
    });
    res.json({ ok: true, reply: text, meta: { model: claude.CHAT_MODEL, usage } });
  } catch (err) {
    const { status, message: errMsg } = claude.mapAnthropicError(err);
    res.status(status).json({ ok: false, error: errMsg });
  }
});

// --- PDF exports --------------------------------------------------------
// SOAP report → PDF
app.post('/api/soap/export-pdf', (req, res) => {
  const { patient, soap, vet, date, ownerSummary } = req.body || {};
  if (!soap || typeof soap !== 'object') {
    return res.status(400).json({ ok: false, error: 'champ "soap" requis (objet avec clés S, O, A, P)' });
  }

  const p = patient || {};
  const patientLine = p.nm
    ? `${p.nm} — ${p.sp || ''}${p.breed ? ' (' + p.breed + ')' : ''}`.trim()
    : 'Patient non précisé';
  const patientSub = [p.age, p.sex, p.wt].filter(Boolean).join(' · ');
  const ownerLine = p.owner || 'Propriétaire non précisé';
  const ownerSub = p.phone || '';
  const dateStr = date || pdf.formatDate();

  const filename = `CR_${pdf.safeFilenamePart(p.nm || 'patient')}_${pdf.formatDateForFilename(new Date())}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = pdf.createDoc();
  doc.pipe(res);

  pdf.drawHeader(doc, { title: 'Compte rendu de consultation', subtitle: 'Format SOAP — Document professionnel', date: dateStr });
  pdf.drawPatientBlock(doc, { patientLine, patientSub, ownerLine, ownerSub });

  pdf.drawSoapSection(doc, { letter: 'S', title: 'Subjectif — motif & anamnèse',     content: soap.S });
  pdf.drawSoapSection(doc, { letter: 'O', title: 'Objectif — examen clinique',       content: soap.O });
  pdf.drawSoapSection(doc, { letter: 'A', title: 'Analyse — suspicion diagnostique', content: soap.A });
  pdf.drawSoapSection(doc, { letter: 'P', title: 'Plan — examens, traitement, suivi', content: soap.P });

  if (ownerSummary && ownerSummary.trim()) {
    doc.moveDown(0.5);
    doc.fillColor(pdf.COLORS.NAVY).font('Helvetica-Bold').fontSize(11).text('Résumé pour le propriétaire', 50);
    doc.moveDown(0.4);
    doc.fillColor(pdf.COLORS.TXT).font('Helvetica').fontSize(10).lineGap(2)
      .text(ownerSummary, 50, doc.y, { width: doc.page.width - 100 });
    doc.moveDown(0.6);
  }

  // Signature
  doc.moveDown(0.8);
  doc.fillColor(pdf.COLORS.TXT2).font('Helvetica').fontSize(9)
    .text(`Vétérinaire : ${vet || 'Dr. Jean Martin'}`, 50, doc.y, { align: 'right', width: doc.page.width - 100 });

  pdf.drawFooter(doc);
  doc.end();
});

// Diagnostic results → PDF
app.post('/api/diagnostic/export-pdf', (req, res) => {
  const { patient, symptoms, result, date } = req.body || {};
  if (!result || !Array.isArray(result.hypotheses)) {
    return res.status(400).json({ ok: false, error: 'champ "result" requis (objet avec hypotheses[])' });
  }

  const p = patient || {};
  const patientLine = p.nm
    ? `${p.nm} — ${p.sp || ''}${p.breed ? ' (' + p.breed + ')' : ''}`.trim()
    : 'Patient non précisé';
  const patientSub = [p.age, p.sex, p.wt].filter(Boolean).join(' · ');
  const ownerLine = p.owner || 'Propriétaire non précisé';
  const ownerSub = p.phone || '';
  const dateStr = date || pdf.formatDate();

  const filename = `Diagnostic_${pdf.safeFilenamePart(p.nm || 'patient')}_${pdf.formatDateForFilename(new Date())}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = pdf.createDoc();
  doc.pipe(res);

  pdf.drawHeader(doc, { title: 'Aide au diagnostic', subtitle: 'Analyse IA des symptômes', date: dateStr });
  pdf.drawPatientBlock(doc, { patientLine, patientSub, ownerLine, ownerSub });

  if (symptoms) {
    doc.fillColor(pdf.COLORS.TEAL).font('Helvetica-Bold').fontSize(8).text('SYMPTÔMES RAPPORTÉS', 50, doc.y, { characterSpacing: 0.5 });
    doc.moveDown(0.3);
    doc.fillColor(pdf.COLORS.TXT).font('Helvetica-Oblique').fontSize(10).lineGap(1.5)
      .text(symptoms, 50, doc.y, { width: doc.page.width - 100 });
    doc.moveDown(1);
  }

  pdf.drawUrgencyBadge(doc, { urgency: result.urgency, urgencyLabel: result.urgencyLabel });

  doc.fillColor(pdf.COLORS.NAVY).font('Helvetica-Bold').fontSize(12).text('Hypothèses diagnostiques', 50, doc.y);
  doc.moveDown(0.6);

  result.hypotheses.forEach((h, i) => {
    pdf.drawHypothesis(doc, {
      index: i + 1,
      name: h.nm || 'Hypothèse',
      prob: h.prob || 0,
      level: h.lv || 'lo',
      desc: h.desc,
      exams: h.exams,
    });
  });

  pdf.drawDisclaimer(doc, "Cette analyse est générée par IA à titre indicatif. Elle ne remplace en aucun cas l'examen clinique et le jugement professionnel du vétérinaire.");

  pdf.drawFooter(doc);
  doc.end();
});

// Ordonnance → PDF
app.post('/api/ordonnance/export-pdf', (req, res) => {
  const { patient, clinique = [], pharmacie = [], alerteAllergies = [], diagnostic, ordonnanceNum, date, vet } = req.body || {};
  if (!patient || !patient.nm) {
    return res.status(400).json({ ok: false, error: 'patient requis (objet avec nm)' });
  }
  if (!Array.isArray(clinique) || !Array.isArray(pharmacie) || (clinique.length + pharmacie.length === 0)) {
    return res.status(400).json({ ok: false, error: 'au moins un médicament requis (clinique ou pharmacie)' });
  }

  const num = ordonnanceNum || `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const filename = `Ordonnance_${pdf.safeFilenamePart(patient.nm)}_${pdf.formatDateForFilename(new Date())}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = pdf.createDoc();
  doc.pipe(res);

  pdf.drawOrdonnanceHeader(doc, {
    ordonnanceNum: num,
    diagnostic,
    date: date || pdf.formatDate(),
  });

  const patientLine = `${patient.nm} — ${patient.sp || ''}${patient.breed ? ' (' + patient.breed + ')' : ''}`.trim();
  const patientSub = [patient.age, patient.sex, patient.wt].filter(Boolean).join(' · ');
  pdf.drawPatientBlock(doc, {
    patientLine, patientSub,
    ownerLine: patient.owner || 'Propriétaire non précisé',
    ownerSub: patient.phone || '',
  });

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

  pdf.drawDisclaimer(doc, "Le vétérinaire prescripteur reste seul responsable de la prescription. Ordonnance valable 1 an pour la dispensation initiale, 6 mois pour le renouvellement. À usage vétérinaire exclusif. Conserver hors de portée des enfants et des animaux.");

  pdf.drawSignatureBlock(doc, { vet: vet || 'Dr. Jean Martin', ordreNum: '75-12345' });

  pdf.drawFooter(doc);
  doc.end();
});

// --- 404 for unknown /api/* --------------------------------------------
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'route API inconnue' });
});

module.exports = app;
