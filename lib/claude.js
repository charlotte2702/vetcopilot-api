const Anthropic = require('@anthropic-ai/sdk');

// `claude-sonnet-4-6` is the current Sonnet alias and the recommended migration
// target for the (now-retired) `claude-sonnet-4-20250514` originally requested.
// Override via ANTHROPIC_MODEL env var without code changes.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

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
  DIAGNOSTIC_SYSTEM,
  SOAP_SYSTEM,
  IMAGE_DIAGNOSTIC_SYSTEM,
  callClaudeJSON,
  callClaudeImageJSON,
  mapAnthropicError,
};
