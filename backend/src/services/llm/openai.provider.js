import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../../prompts/study.prompts.js';
import { AppError } from '../../utils/AppError.js';
import { parseAndValidateStudyJson, sleep } from './shared.js';

const openai = new OpenAI({ apiKey: env.openaiApiKey, maxRetries: 0 });

function mapOpenAIError(err) {
  const status = err?.status ?? err?.response?.status;
  const message = err?.message ?? 'OpenAI request failed';
  const code = err?.error?.code ?? err?.code ?? null;

  if (status === 401) {
    return new AppError(
      'Invalid OpenAI API key. Set OPENAI_API_KEY in backend/.env or switch LLM_PROVIDER=gemini for a free key.',
      502,
      'LLM_AUTH_ERROR'
    );
  }
  if (code === 'insufficient_quota' || message.toLowerCase().includes('quota')) {
    return new AppError(
      'OpenAI has no remaining quota. Add billing at https://platform.openai.com/account/billing or use LLM_PROVIDER=gemini with a free Google AI key.',
      402,
      'LLM_QUOTA_EXCEEDED'
    );
  }
  if (status === 429) {
    return new AppError('OpenAI rate limit reached. Wait and try again.', 429, 'LLM_RATE_LIMIT');
  }

  return new AppError(`OpenAI error: ${message}`, 502, 'LLM_ERROR');
}

export async function generateWithOpenAI({ topic, level, focus }) {
  const maxAttempts = env.llmMaxRetries + 1;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: env.openaiModel,
        temperature: 0.7,
        max_tokens: env.llmMaxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt({ topic, level, focus }) },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      const content = parseAndValidateStudyJson(raw, 'OpenAI');

      return {
        content,
        model: completion.model ?? env.openaiModel,
        usage: completion.usage ?? null,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;

      lastError = err;
      const status = err?.status ?? err?.response?.status;
      const code = err?.error?.code;

      if (code === 'insufficient_quota') throw mapOpenAIError(err);

      if (status === 429 && attempt < maxAttempts) {
        await sleep(Math.min(5000 * 2 ** (attempt - 1), 45000));
        continue;
      }

      throw mapOpenAIError(err);
    }
  }

  throw mapOpenAIError(lastError);
}
