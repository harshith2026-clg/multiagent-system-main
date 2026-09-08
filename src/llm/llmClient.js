import { GoogleGenAI } from '@google/genai';

export class LLMError extends Error {
  constructor(message, code = 'LLM_ERROR', details = undefined) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash'
].filter(Boolean);

function unique(items) {
  return [...new Set(items)];
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new LLMError(`${label} timed out after ${Math.ceil(ms / 1000)}s`, 'LLM_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function extractJson(text) {
  const cleaned = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  throw new LLMError('Gemini returned a response that was not valid JSON.', 'INVALID_JSON');
}

function isUnavailableModel(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return /404|not_found|model.*not.*available|no longer available|new users/.test(message);
}

function isRetryable(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return isUnavailableModel(error) || /429|resource_exhausted|temporar|unavailable/.test(message);
}

export async function generateJson(prompt, { timeoutMs = 45000 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new LLMError('Gemini is not configured. Add GEMINI_API_KEY to your .env file and restart the server.', 'MISSING_API_KEY');
  }

  const ai = new GoogleGenAI({ apiKey });
  const models = unique(DEFAULT_MODELS);
  let lastError;

  for (const model of models) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        }),
        timeoutMs,
        `Gemini (${model}) request`
      );

      const output = typeof response.text === 'function'
        ? await response.text()
        : (response.text || response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '');
      return extractJson(output);
    } catch (error) {
      lastError = error;
      // Try the next current model when an account/model is unavailable or the service is transiently unavailable.
      if (model !== models.at(-1) && isRetryable(error)) continue;
      break;
    }
  }

  if (lastError instanceof LLMError) throw lastError;
  const raw = String(lastError?.message || 'Unknown Gemini error');
  const code = isUnavailableModel(lastError) ? 'MODEL_UNAVAILABLE' : 'GEMINI_FAILURE';
  throw new LLMError(
    code === 'MODEL_UNAVAILABLE'
      ? 'No configured Gemini model is available to this API key. Set GEMINI_MODEL to a model available in your Google AI project.'
      : `Gemini request failed: ${raw}`,
    code
  );
}

export const geminiStatus = () => ({
  configured: Boolean(process.env.GEMINI_API_KEY),
  models: unique(DEFAULT_MODELS)
});
