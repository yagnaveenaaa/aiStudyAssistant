import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../../prompts/study.prompts.js';
import { AppError } from '../../utils/AppError.js';
import { parseAndValidateStudyJson, sleep } from './shared.js';

const groq = new OpenAI({
  apiKey: env.groqApiKey,
  baseURL: 'https://api.groq.com/openai/v1',
  maxRetries: 0,
});

function mapGroqError(err) {
  const status = err?.status ?? err?.response?.status;
  const message = err?.message ?? 'Groq request failed';

  if (status === 401) {
    return new AppError(
      'Invalid Groq API key. Get a free key at https://console.groq.com/keys and set GROQ_API_KEY in backend/.env',
      502,
      'LLM_AUTH_ERROR'
    );
  }
  if (status === 429) {
    return new AppError('Groq rate limit reached. Wait and try again.', 429, 'LLM_RATE_LIMIT');
  }

  return new AppError(`Groq error: ${message}`, 502, 'LLM_ERROR');
}

export async function generateWithGroq({ topic, level, focus }) {
  const maxAttempts = env.llmMaxRetries + 1;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: env.groqModel,
        temperature: 0.7,
        max_tokens: env.llmMaxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt({ topic, level, focus }) },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      const content = parseAndValidateStudyJson(raw, 'Groq');

      return {
        content,
        model: completion.model ?? env.groqModel,
        usage: completion.usage ?? null,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;

      lastError = err;
      const status = err?.status ?? err?.response?.status;

      if (status === 429 && attempt < maxAttempts) {
        await sleep(Math.min(3000 * 2 ** (attempt - 1), 20000));
        continue;
      }

      throw mapGroqError(err);
    }
  }

  throw mapGroqError(lastError);
}
