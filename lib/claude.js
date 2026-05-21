const Anthropic = require('@anthropic-ai/sdk');

// `claude-sonnet-4-6` is the current Sonnet alias and the recommended migration
// target for the (now-retired) `claude-sonnet-4-20250514` originally requested.
// Override via ANTHROPIC_MODEL env var without code changes.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// Cheaper, faster model dedicated to the chatbot route — chat questions don't
// need Sonnet's intelligence and Haiku is ~10x cheaper per token.
const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL || 'claude-haiku-4-5-20251001';

const client = new Anthropic.Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60 * 1000, // SOAP responses with 2500 max_tokens can run 30-50s
  maxRetries: 2,
});

// System prompts are stable across requests → cached with cache_control.
// Keep them deterministic (no timestamps, no per-request IDs) so the prefix
// stays cacheable.

const DIAGNOSTIC_SYSTEM = `Tu es un assistant vétérinaire expert francophone. Tu analyses les symptômes rapportés par un vétérinaire en consultation et tu fournis 3 hypothèses diagnostiques pertinentes, priorisées par probabilité décroissante.

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide, sans markdown, sans préambule, sans explication hors-JSON, suivant EXACTEMENT cette structure :

{
  "urgency": "faible" | "moderee" | "elevee" | "critique",
  "urgencyLabel": "FAIBLE" | "MODÉRÉE" | "ÉLEVÉE" | "CRITIQUE",
  "hypotheses": [
    {
      "nm": "Nom court et clinique de l'hypothèse",
      "prob": <entier 0-100>,
      "lv": "hi" | "md" | "lo",
      "desc": "Description clinique en 2-3 phrases : pourquoi cette hypothèse, quels éléments du tableau l'orientent",
      "exams": ["Examen 1", "Examen 2", ...]
    }
  ]
}

Règles strictes :
- Exactement 3 hypothèses, triées par "prob" décroissant
- "lv" reflète la confiance : "hi" si prob ≥ 50, "md" si 30 ≤ prob < 50, "lo" si prob < 30
- "exams" : 3 à 6 examens complémentaires concrets et hiérarchisés (du moins au plus invasif/coûteux)
- "urgency" reflète l'urgence globale de la prise en charge, pas la gravité maximale théorique
- Reste pragmatique : médecine vétérinaire de terrain française, pas exhaustif académique
- Ne mentionne pas que tu es une IA ; rédige comme un confrère senior qui dicte son raisonnement`;

const SOAP_SYSTEM = `Tu es un assistant vétérinaire expert francophone. Tu rédiges des comptes rendus SOAP (Subjectif, Objectif, Analyse, Plan) à partir des informations de consultation fournies par le vétérinaire, plus une version simplifiée destinée au propriétaire de l'animal.

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide, sans markdown, sans préambule, suivant EXACTEMENT cette structure :

{
  "soap": {
    "S": "Section Subjectif : motif de consultation, anamnèse, signalement, observations rapportées par le propriétaire",
    "O": "Section Objectif : examen clinique, constantes (T°, FC, FR, TRC, muqueuses), palpation, observations objectives",
    "A": "Section Analyse : synthèse diagnostique, hypothèse principale, diagnostics différentiels à considérer",
    "P": "Section Plan : examens complémentaires prescrits, traitement (avec posologie si applicable), suivi, consignes au propriétaire"
  },
  "ownerSummary": "Version simplifiée pour le propriétaire en 3 à 5 phrases, sans jargon médical, ton bienveillant et vouvoyé. Explique : ce qui a été fait, ce qu'on suspecte, ce qu'il faut faire à la maison et quand revenir."
}

Règles strictes :
- Si une info manque (ex. examen non rapporté), génère un contenu plausible basé sur le contexte mais reste générique — ne pas inventer de valeurs chiffrées précises non fournies
- Chaque section SOAP peut utiliser des sauts de ligne (\\n) et des tirets pour structurer ; reste lisible
- ownerSummary : pas d'inquiétude inutile, pas de minimisation non plus
- Ne mentionne pas que tu es une IA`;

const IMAGE_DIAGNOSTIC_SYSTEM = `Tu es un vétérinaire expert en imagerie médicale et en dermatologie vétérinaire francophone. Tu analyses des images médicales/cliniques (radiographies, échographies, photos cliniques, lésions cutanées, photos d'œil) en consultation et tu fournis une interprétation structurée.

Le clinicien t'indique le TYPE d'examen attendu (Radiographie, Échographie, Photo clinique, Plaie / dermatologie, Œil, Autre). Si l'image ne correspond pas au type indiqué, ou si elle est trop floue / mal cadrée / non médicale, signale-le clairement dans "observations" et baisse "quality" à "medium".

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide, sans markdown, sans préambule, suivant EXACTEMENT cette structure :

{
  "detectedType": "Type précis détecté (ex: 'Radiographie thoracique latérale gauche')",
  "quality": "good" | "medium",
  "qualityLabel": "Bonne" | "Moyenne",
  "urgency": "faible" | "moderee" | "elevee" | "critique",
  "urgencyLabel": "FAIBLE" | "MODÉRÉE" | "ÉLEVÉE" | "CRITIQUE",
  "observations": [
    "Observation 1 : ce que l'on voit, localisation précise",
    ... 3 à 6 observations factuelles
  ],
  "hypotheses": [
    {
      "nm": "Nom clinique court de l'hypothèse",
      "prob": <entier 0-100>,
      "lv": "hi" | "md" | "lo",
      "desc": "Justification en 1-2 phrases"
    }
    // exactement 3 hypothèses, triées par "prob" décroissant
  ],
  "exams": [
    "Examen complémentaire 1",
    ... 3 à 6 examens hiérarchisés
  ]
}

Règles strictes :
- "lv" : "hi" si prob ≥ 50, "md" si 30 ≤ prob < 50, "lo" si prob < 30
- "observations" décrivent UNIQUEMENT ce qui est visible sur l'image (pas d'inférence non visuelle)
- Si l'image est inexploitable : "quality":"medium", "urgency":"faible", une seule entrée hypotheses {nm:"Analyse non concluante", prob:0, lv:"lo", desc:"Image insuffisante pour une analyse fiable"}, et "exams" propose un meilleur cliché
- Reste pragmatique : médecine vétérinaire française de terrain, pas de jargon excessif
- Ne mentionne pas que tu es une IA`;

const CHAT_SYSTEM_BASE = `Tu es VetCopilot, un assistant IA expert en médecine vétérinaire. Tu aides les vétérinaires au quotidien. Tu peux :
- Répondre à des questions sur les médicaments vétérinaires (posologie, interactions, contre-indications)
- Donner des informations sur les pathologies animales
- Aider à interpréter des résultats d'analyses
- Donner des conseils sur les protocoles de soins
- Répondre sur les patients de la clinique quand le contexte est fourni
- Informer sur le planning et les rendez-vous

Tu réponds toujours en français, de manière professionnelle mais accessible. Tu rappelles que tu es un outil d'aide et que le vétérinaire garde la décision finale.

Style de réponse :
- Reste concis : 3 à 6 phrases sauf si on te demande explicitement un développement détaillé
- Évite les listes à puces interminables ; préfère des paragraphes courts
- Pas de préambule du type "Bonjour, je vais répondre..." — réponds directement
- Si une question dépasse ton domaine ou nécessite un examen physique, dis-le clairement`;

/**
 * Build the chat system prompt with optional clinic context (animals + appointments)
 * and a focused patient. Data is injected as compact JSON so Claude can answer
 * questions like "Quel est le RDV de 9h ?" or "Allergies de Rex ?".
 */
function buildChatSystem({ animals, appointments, animal }) {
  const parts = [CHAT_SYSTEM_BASE];
  if (animals && animals.length) {
    // Strip noisy fields (weights chart, full vaccine history) — keep what's useful for Q&A.
    const compact = animals.map(a => ({
      id: a.id, nm: a.nm, sp: a.sp, breed: a.breed, age: a.age, sex: a.sex, wt: a.wt,
      owner: a.owner, phone: a.phone,
      allergy: a.allergy || [],
      hist: (a.hist || []).map(h => `${h.t} (${h.d})`),
    }));
    parts.push('\n\n=== PATIENTS DE LA CLINIQUE ===');
    parts.push(JSON.stringify(compact, null, 2));
  }
  if (appointments && appointments.length) {
    parts.push('\n=== RENDEZ-VOUS DU JOUR ===');
    const compact = appointments.map(a => ({ t: a.t, nm: a.nm, own: a.own, rsn: a.rsn, vet: a.vet, dur: a.dur, st: a.st }));
    parts.push(JSON.stringify(compact, null, 2));
  }
  if (animal) {
    parts.push('\n=== PATIENT EN COURS DE CONSULTATION ===');
    parts.push(`Le vétérinaire consulte actuellement le dossier de ${animal.nm}.`);
    parts.push(JSON.stringify(animal, null, 2));
  }
  return parts.join('\n');
}

/**
 * Send a chat turn to Claude. `messages` is the full conversation as
 * [{ role: 'user'|'assistant', content: string }, ...], current user message included.
 */
async function callClaudeChat({ messages, animals, appointments, animal, maxTokens = 1500 }) {
  const response = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: buildChatSystem({ animals, appointments, animal }), cache_control: { type: 'ephemeral' } },
    ],
    messages,
  });
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('Réponse Claude sans bloc texte');
  return { text: textBlock.text, usage: response.usage, stop_reason: response.stop_reason };
}

const ORDONNANCE_SYSTEM = `Tu es un assistant vétérinaire francophone spécialisé en pharmacologie clinique. Tu rédiges des ordonnances complètes adaptées au diagnostic et aux données patient fournies par le vétérinaire.

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide, sans markdown, sans préambule, suivant EXACTEMENT cette structure :

{
  "alerteAllergies": [
    "Texte d'alerte si une allergie connue impacte les choix thérapeutiques (ex: \\"Allergie Pénicilline notée — exclure les β-lactamines ; alternative : céfalexine ou marbofloxacine\\")"
  ],
  "clinique": [
    {
      "nm": "Nom commercial",
      "dci": "Dénomination commune internationale",
      "forme": "Forme galénique (ex: solution injectable 10 mg/mL)",
      "dose_par_kg": "Posologie de référence (ex: 1 mg/kg)",
      "dose_calculee": "Dose effective pour CE patient (calcul fait à partir du poids)",
      "voie": "PO | SC | IM | IV | topique",
      "frequence": "ex: 1 injection/jour",
      "duree": "ex: 3 jours",
      "contre_indications": "Principales CI à connaître",
      "remarques": "Conseils d'administration ou de surveillance"
    }
  ],
  "pharmacie": [ /* même structure */ ]
}

Règles strictes :
- "clinique" : médicaments délivrés à la clinique le jour-même → vaccins, antiparasitaires (ex: Frontline, Bravecto, Milbemax), antibiotiques courants (Synulox, Marbocyl, Convenia), AINS injectables (Metacam, Carprofen inj), antiémétiques (Cerenia), corticoïdes injectables, fluides
- "pharmacie" : médicaments humains détournés (oméprazole, gabapentine, amlodipine…) ou médicaments spéciaux non stockés à la clinique
- 1 à 4 médicaments par section, total ≤ 6. Pas de duplicats.
- "dose_calculee" doit calculer réellement : (poids du patient) × (dose/kg) → arrondi raisonnable, en mg ou mL selon la galénique
- "alerteAllergies" : si une allergie est notée chez le patient, liste les familles à éviter ET propose les alternatives utilisées. Tableau vide [] sinon.
- Contre-indications spécifiques à l'espèce : pas de paracétamol pour le chat, pas d'ibuprofène ni de naproxène pour le chien/chat, prudence AINS chez le chat, etc.
- Si le diagnostic ne nécessite pas de médicament (observation, hygiène, repos), retourner clinique:[] et pharmacie:[] avec une remarque dans alerteAllergies expliquant la conduite
- Posologies de référence : Vidal Vétérinaire ou pratique française courante
- Ne mentionne pas que tu es une IA`;

function buildOrdonnancePrompt(animal, diagnostic, symptoms) {
  const lines = [];
  lines.push('Patient :');
  lines.push(`- Nom : ${animal.nm}`);
  lines.push(`- Espèce : ${animal.sp}${animal.breed ? ' (' + animal.breed + ')' : ''}`);
  if (animal.age) lines.push(`- Âge : ${animal.age}`);
  if (animal.sex) lines.push(`- Sexe : ${animal.sex}`);
  if (animal.wt) lines.push(`- Poids : ${animal.wt}`);
  if (animal.allergy && animal.allergy.length) {
    lines.push(`- Allergies connues : ${animal.allergy.join(', ')}`);
  } else {
    lines.push('- Allergies connues : aucune');
  }
  if (animal.hist && animal.hist.length) {
    lines.push(`- Antécédents : ${animal.hist.map(h => `${h.t} (${h.d})`).join(' ; ')}`);
  }
  lines.push('');
  lines.push(`Diagnostic suspecté : ${diagnostic || '(non précisé)'}`);
  lines.push(`Symptômes / motif : ${symptoms || '(non précisé)'}`);
  lines.push('');
  lines.push('Génère l\'ordonnance correspondante en JSON suivant la structure définie.');
  return lines.join('\n');
}

async function callClaudeOrdonnance({ animal, diagnostic, symptoms, maxTokens = 2500 }) {
  const userPrompt = buildOrdonnancePrompt(animal, diagnostic, symptoms);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: ORDONNANCE_SYSTEM, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });
  return { parsed: parseJSONFromTextBlock(response), usage: response.usage, stop_reason: response.stop_reason };
}

function parseJSONFromTextBlock(response) {
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('Réponse Claude sans bloc texte');
  let text = textBlock.text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(text);
}

/**
 * Calls Claude and parses the response as JSON.
 * The system prompt is sent as a cached block (ephemeral, 5 min TTL).
 */
async function callClaudeJSON({ system, userPrompt, maxTokens = 2048 }) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });
  return { parsed: parseJSONFromTextBlock(response), usage: response.usage, stop_reason: response.stop_reason };
}

/**
 * Same as callClaudeJSON but the user message contains an image (vision input).
 * `imageBase64` must be the base64 data WITHOUT the `data:...;base64,` prefix.
 */
async function callClaudeImageJSON({ system, userText, imageBase64, mediaType, maxTokens = 3000 }) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: userText },
      ],
    }],
  });
  return { parsed: parseJSONFromTextBlock(response), usage: response.usage, stop_reason: response.stop_reason };
}

/**
 * Maps Anthropic SDK errors (and JSON parse errors) to { status, message }
 * suitable for an Express response. Never includes the API key in the message.
 */
function mapAnthropicError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 500, message: 'Clé API Anthropic invalide (vérifier ANTHROPIC_API_KEY dans .env)' };
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return { status: 500, message: 'Accès Anthropic refusé (permissions du compte)' };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, message: 'Quota Anthropic atteint, réessayer dans quelques instants' };
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 504, message: 'Délai dépassé en appelant l\'API Anthropic' };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 503, message: 'Connexion à l\'API Anthropic impossible' };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { status: 400, message: `Requête Anthropic invalide : ${err.message}` };
  }
  if (err instanceof Anthropic.APIError) {
    return { status: 502, message: `Erreur API Anthropic (${err.status || '?'}) : ${err.message}` };
  }
  if (err instanceof SyntaxError) {
    return { status: 502, message: `Claude n'a pas renvoyé un JSON valide : ${err.message}` };
  }
  return { status: 500, message: `Erreur inattendue : ${err.message || String(err)}` };
}

module.exports = {
  MODEL,
  CHAT_MODEL,
  DIAGNOSTIC_SYSTEM,
  SOAP_SYSTEM,
  IMAGE_DIAGNOSTIC_SYSTEM,
  ORDONNANCE_SYSTEM,
  callClaudeJSON,
  callClaudeImageJSON,
  callClaudeChat,
  callClaudeOrdonnance,
  mapAnthropicError,
};
