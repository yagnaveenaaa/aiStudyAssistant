import { validateStudyContent } from '../../schemas/study.response.schema.js';
import { AppError } from '../../utils/AppError.js';

export function parseAndValidateStudyJson(raw, providerLabel) {
  if (!raw) {
    throw new AppError(`Empty response from ${providerLabel}`, 502, 'LLM_EMPTY_RESPONSE');
  }

  let text = raw.trim();

  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError(`${providerLabel} returned invalid JSON`, 502, 'LLM_INVALID_JSON');
  }

  const validated = validateStudyContent(parsed);

  if (!validated.success) {
    const details = validated.error.issues.map((i) => i.message).join('; ');
    throw new AppError(`Study content failed validation: ${details}`, 502, 'LLM_SCHEMA_MISMATCH');
  }

  return validated.data;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
