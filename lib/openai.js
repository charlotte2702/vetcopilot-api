// OpenAI provider — used for diagnostic, SOAP and ordonnance routes (text in,
// strict JSON out). Mirrors the API surface of lib/claude.js so the routes can
// stay symmetric and fall back to Claude on failure.

const OpenAI = require('openai');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

const client = new OpenAI.OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60_000,
  maxRetries: 2,
});

/**
 * Same return shape as claude.callClaudeJSON: { parsed, usage, stop_reason }.
 * Uses gpt-4o's native JSON mode — the response is guaranteed to parse, so we
 * don't need fence-stripping like with Claude.
 */
async function callOpenAIJSON({ system, userPrompt, maxTokens = 2500 }) {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
  });
  const text = response.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error("Réponse OpenAI vide");
  const parsed = JSON.parse(text);
  return {
    parsed,
    usage: response.usage,
    stop_reason: response.choices?.[0]?.finish_reason,
  };
}

/**
 * Same as callOpenAIJSON but accepts a base64 image as part of the user
 * message — kept for completeness even though the image route uses Gemini.
 */
async function callOpenAIImageJSON({ system, userText, imageBase64, mediaType, maxTokens = 3000 }) {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
        ],
      },
    ],
  });
  const text = response.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error("Réponse OpenAI vide");
  return {
    parsed: JSON.parse(text),
    usage: response.usage,
    stop_reason: response.choices?.[0]?.finish_reason,
  };
}

/**
 * Returns { status, message } for an Express response. Never includes the key.
 */
function mapOpenAIError(err) {
  const status = err && err.status;
  const msg = (err && err.message) || String(err);
  if (status === 401) return { status: 500, message: 'Clé API OpenAI invalide (vérifier OPENAI_API_KEY)' };
  if (status === 403) return { status: 500, message: 'Accès OpenAI refusé (organisation / quota)' };
  if (status === 429) return { status: 429, message: 'Quota OpenAI atteint, réessayer plus tard' };
  if (status === 400) return { status: 400, message: `Requête OpenAI invalide : ${msg}` };
  if (status === 408 || /timeout/i.test(msg)) return { status: 504, message: 'Timeout en appelant OpenAI' };
  if (status && status >= 500) return { status: 502, message: `OpenAI 5xx (${status}) : ${msg}` };
  if (err instanceof SyntaxError) return { status: 502, message: `OpenAI n'a pas renvoyé un JSON valide : ${msg}` };
  return { status: 500, message: `Erreur OpenAI : ${msg}` };
}

module.exports = { MODEL, callOpenAIJSON, callOpenAIImageJSON, mapOpenAIError };
