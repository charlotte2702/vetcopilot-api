const express = require('express');
const cors = require('cors');
const { ANIMALS, APTS, NOTIFS, INVOICES, DIAG_RESULTS } = require('./data');

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

// --- Diagnostic ---------------------------------------------------------
app.post('/api/diagnostic', (req, res) => {
  const { animalId, symptoms, notes } = req.body || {};
  res.json({
    ok: true,
    input: { animalId: animalId ?? null, symptoms: symptoms ?? '', notes: notes ?? '' },
    result: DIAG_RESULTS,
  });
});

// --- SOAP ---------------------------------------------------------------
app.post('/api/soap/generate', (req, res) => {
  const { animalId, motif, examen, hypothese, traitement } = req.body || {};
  const animal = ANIMALS.find(a => a.id === Number(animalId));
  const nm = animal ? animal.nm : 'Patient';
  const sp = animal ? animal.sp : 'Animal';
  const owner = animal ? animal.owner : 'Propriétaire';

  res.json({
    ok: true,
    soap: {
      patient: { id: animal?.id ?? null, nm, sp, owner },
      generatedAt: new Date().toISOString(),
      S: `Présentation de ${nm} (${sp}) accompagné de ${owner}. Motif rapporté : ${motif || 'consultation générale'}. Le propriétaire signale les symptômes suivants : ${motif || 'aucun symptôme spécifique communiqué'}.`,
      O: examen
        ? `Examen clinique : ${examen}. Constantes dans les limites de la normale sauf mention contraire.`
        : `État général : vigilant. Température : 38.5°C. FC/FR dans les normes. Muqueuses roses, TRC < 2s. Palpation abdominale sans douleur ni masse.`,
      A: hypothese
        ? `Hypothèse principale : ${hypothese}. Diagnostics différentiels à envisager selon l'évolution clinique.`
        : `Suspicion clinique en cours d'évaluation. Examens complémentaires recommandés pour préciser le diagnostic.`,
      P: traitement
        ? `Plan thérapeutique : ${traitement}. Réévaluation à 7 jours ou immédiatement en cas d'aggravation.`
        : `1) Bilan sanguin complet (NFS, biochimie).\n2) Traitement symptomatique en attente des résultats.\n3) Contrôle clinique dans 7 jours.\n4) Consignes de surveillance remises au propriétaire.`,
    },
  });
});

// --- 404 for unknown /api/* --------------------------------------------
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'route API inconnue' });
});

module.exports = app;
