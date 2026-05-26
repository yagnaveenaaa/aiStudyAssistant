import { env } from '../../config/env.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../../prompts/study.prompts.js';
import { AppError } from '../../utils/AppError.js';
import { parseAndValidateStudyJson, sleep } from './shared.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const DEFAULT_FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
];

function getModelChain() {
  const fromEnv = env.geminiFallbackModels?.length
    ? env.geminiFallbackModels
    : DEFAULT_FALLBACK_MODELS;
  return [...new Set([env.geminiModel, ...fromEnv])];
}

function isHighDemandError(status, message, statusDetail) {
  const lower = (message ?? '').toLowerCase();
  return (
    status === 503 ||
    statusDetail === 'UNAVAILABLE' ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('try again later') ||
    lower.includes('temporarily unavailable')
  );
}

function isQuotaError(status, message, statusDetail) {
  const lower = (message ?? '').toLowerCase();
  return (
    (status === 429 || status === 403) &&
    (lower.includes('quota') ||
      lower.includes('billing') ||
      statusDetail === 'RESOURCE_EXHAUSTED')
  );
}

function isRetryableError(status, message, statusDetail) {
  if (isQuotaError(status, message, statusDetail)) return false;
  if (isHighDemandError(status, message, statusDetail)) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

function mapGeminiError(status, body, model) {
  const message = body?.error?.message ?? 'Gemini request failed';
  const statusDetail = body?.error?.status ?? '';
  const lower = message.toLowerCase();

  if (status === 400 && lower.includes('api key')) {
    return new AppError(
      'Invalid Gemini API key. Get a free key at https://aistudio.google.com/apikey',
      502,
      'LLM_AUTH_ERROR',
      { provider: 'gemini', model, status, statusDetail }
    );
  }

  if (isQuotaError(status, message, statusDetail)) {
    return new AppError(
      `Gemini quota exceeded for model "${model}". Try GEMINI_MODEL=gemini-2.5-flash-lite or LLM_PROVIDER=groq.`,
      402,
      'LLM_QUOTA_EXCEEDED',
      { provider: 'gemini', model, status, statusDetail, hint: message }
    );
  }

  if (isHighDemandError(status, message, statusDetail)) {
    return new AppError(
      'Gemini servers are busy (high demand). The app will retry automatically — click Generate once more after a short wait.',
      503,
      'LLM_OVERLOADED',
      { provider: 'gemini', model, status, statusDetail, hint: message }
    );
  }

  if (status === 429) {
    return new AppError(
      'Gemini rate limit. Wait 60 seconds and try again.',
      429,
      'LLM_RATE_LIMIT',
      { provider: 'gemini', model, status, hint: message }
    );
  }

  if (status === 404) {
    return new AppError(
      `Gemini model "${model}" not found.`,
      502,
      'LLM_MODEL_ERROR',
      { provider: 'gemini', model, status, hint: message }
    );
  }

  if (status === 403) {
    return new AppError(
      `Gemini access denied: ${message}`,
      502,
      'LLM_AUTH_ERROR',
      { provider: 'gemini', model, status, hint: message }
    );
  }

  return new AppError(`Gemini error: ${message}`, 502, 'LLM_ERROR', {
    provider: 'gemini',
    model,
    status,
    statusDetail,
    hint: message,
  });
}

async function callGemini(userPrompt, model) {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: env.llmMaxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errMeta = {
      status: response.status,
      message: body?.error?.message,
      statusDetail: body?.error?.status,
      model,
    };
    console.error('[Gemini]', errMeta);

    const error = mapGeminiError(response.status, body, model);
    error.retryable = isRetryableError(
      response.status,
      body?.error?.message,
      body?.error?.status
    );
    throw error;
  }

  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  const finishReason = candidate?.finishReason;

  if (!text) {
    const blockReason = body?.promptFeedback?.blockReason ?? finishReason ?? 'unknown';
    console.error('[Gemini] No text:', { model, finishReason, blockReason });
    throw new AppError(
      `Gemini returned no content (reason: ${blockReason}). Try a different topic.`,
      502,
      'LLM_EMPTY_RESPONSE',
      { provider: 'gemini', model, finishReason, blockReason }
    );
  }

  return {
    text,
    model,
    usage: body?.usageMetadata ?? null,
  };
}

export async function generateWithGemini({ topic, level, focus }) {
  const userPrompt = buildUserPrompt({ topic, level, focus });
  const models = getModelChain();
  const maxAttemptsPerModel = env.llmMaxRetries + 1;
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      try {
        console.log(`[Gemini] Trying model=${model} attempt=${attempt}/${maxAttemptsPerModel}`);
        const { text, model: usedModel, usage } = await callGemini(userPrompt, model);
        const content = parseAndValidateStudyJson(text, 'Gemini');

        if (usedModel !== env.geminiModel) {
          console.log(`[Gemini] Success with fallback model: ${usedModel}`);
        }

        return { content, model: usedModel, usage };
      } catch (err) {
        lastError = err;

        if (err instanceof AppError) {
          if (
            err.code === 'LLM_QUOTA_EXCEEDED' ||
            err.code === 'LLM_AUTH_ERROR' ||
            err.code === 'LLM_MODEL_ERROR'
          ) {
            if (err.code === 'LLM_MODEL_ERROR' && model !== models.at(-1)) {
              console.warn(`[Gemini] Model ${model} not found, trying next…`);
              break;
            }
            throw err;
          }

          if (err.retryable && attempt < maxAttemptsPerModel) {
            const waitMs = Math.min(4000 * 2 ** (attempt - 1), 25000);
            console.warn(`[Gemini] ${err.code} on ${model} — retry in ${waitMs}ms`);
            await sleep(waitMs);
            continue;
          }

          if (err.retryable && model !== models.at(-1)) {
            console.warn(`[Gemini] ${err.code} on ${model} — switching model…`);
            break;
          }

          throw err;
        }

        console.error('[Gemini] Unexpected error:', err);
        throw new AppError('Failed to generate study content with Gemini', 502, 'LLM_ERROR');
      }
    }
  }

  if (lastError instanceof AppError) {
    if (lastError.code === 'LLM_OVERLOADED') {
      throw new AppError(
        'All Gemini models are busy right now. Wait 2–3 minutes and try again, or set LLM_PROVIDER=groq with a free key from https://console.groq.com/keys',
        503,
        'LLM_OVERLOADED',
        { modelsTried: models }
      );
    }
    throw lastError;
  }

  throw new AppError('Gemini failed after all retries', 502, 'LLM_ERROR');
}
