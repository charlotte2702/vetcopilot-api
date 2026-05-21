const express = require('express');
const cors = require('cors');
const { ANIMALS, APTS, NOTIFS, INVOICES } = require('./data');
const claude = require('./claude');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

// --- 404 for unknown /api/* --------------------------------------------
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'route API inconnue' });
});

module.exports = app;
