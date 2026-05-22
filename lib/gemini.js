// Gemini provider — used for the chatbot (text in / text out) and the
// veterinary image analysis route (vision in / JSON out). Designed to expose
// the same shape as lib/claude.js so the routes can do an easy fallback.

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function buildModel({ system, json = false, maxTokens = 2048, temperature = 0.5 }) {
  return genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: system,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  });
}

// Convert the Anthropic-style [{role:'user'|'assistant', content:string}] history
// to Gemini's [{role:'user'|'model', parts:[{text}]}] format.
function toGeminiHistory(messages) {
  return (messages || []).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }));
}

/**
 * Chat with conversation history. `messages` follows the Anthropic shape
 * [{role:'user'|'assistant', content:string}]. The last entry must be a user
 * turn (it's what we send). Returns { text, usage, stop_reason }.
 */
async function callGeminiChat({ messages, system, maxTokens = 1500 }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages requis (au moins 1 turn)');
  }
  const last = messages[messages.length - 1];
  if (last.role !== 'user') throw new Error('Le dernier message doit être role=user');

  const model = buildModel({ system, maxTokens, temperature: 0.6 });
  const chat = model.startChat({ history: toGeminiHistory(messages.slice(0, -1)) });
  const result = await chat.sendMessage(String(last.content || ''));
  const text = result.response.text();
  if (!text || !text.trim()) throw new Error('Réponse Gemini vide');
  return {
    text,
    usage: result.response.usageMetadata || null,
    stop_reason: result.response.candidates?.[0]?.finishReason || null,
  };
}

/**
 * Image analysis with strict JSON output. Returns { parsed, usage, stop_reason }.
 */
async function callGeminiImageJSON({ system, userText, imageBase64, mediaType, maxTokens = 3000 }) {
  const model = buildModel({ system, json: true, maxTokens, temperature: 0.4 });
  const result = await model.generateContent([
    { inlineData: { data: imageBase64, mimeType: mediaType } },
    { text: userText },
  ]);
  const text = result.response.text();
  if (!text || !text.trim()) throw new Error('Réponse Gemini vide');
  return {
    parsed: JSON.parse(text),
    usage: result.response.usageMetadata || null,
    stop_reason: result.response.candidates?.[0]?.finishReason || null,
  };
}

/**
 * Returns { status, message } suitable for an Express response.
 */
function mapGeminiError(err) {
  const msg = (err && err.message) || String(err);
  if (/API_KEY|api key/i.test(msg)) return { status: 500, message: 'Clé API Gemini invalide (vérifier GEMINI_API_KEY)' };
  if (/quota|RESOURCE_EXHAUSTED|rate limit/i.test(msg)) return { status: 429, message: 'Quota Gemini atteint, réessayer plus tard' };
  if (/timeout|ETIMEDOUT/i.test(msg)) return { status: 504, message: 'Timeout en appelant Gemini' };
  if (/PERMISSION_DENIED/i.test(msg)) return { status: 500, message: 'Accès Gemini refusé (vérifier permissions du projet)' };
  if (err instanceof SyntaxError) return { status: 502, message: `Gemini n'a pas renvoyé un JSON valide : ${msg}` };
  return { status: 500, message: `Erreur Gemini : ${msg}` };
}

module.exports = { MODEL, callGeminiChat, callGeminiImageJSON, mapGeminiError };
