import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { generateWithGemini } from './gemini.provider.js';
import { generateWithOpenAI } from './openai.provider.js';
import { generateWithGroq } from './groq.provider.js';

const providers = {
  gemini: generateWithGemini,
  openai: generateWithOpenAI,
  groq: generateWithGroq,
};

export async function generateStudyContent(params) {
  const fn = providers[env.llmProvider];

  if (!fn) {
    throw new AppError(`Unknown LLM_PROVIDER: ${env.llmProvider}`, 500, 'CONFIG_ERROR');
  }

  return fn(params);
}

export function getLlmProviderInfo() {
  return {
    provider: env.llmProvider,
    model:
      env.llmProvider === 'gemini'
        ? env.geminiModel
        : env.llmProvider === 'groq'
          ? env.groqModel
          : env.openaiModel,
  };
}
