import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
const dotenvResult = dotenv.config({ path: envPath });

function normalizeKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

const PLACEHOLDER_PATTERNS = [
  /^sk-your-key-here$/i,
  /^your[_-]?api[_-]?key$/i,
  /^changeme$/i,
  /^xxx+$/i,
  /^paste-/i,
];

function isPlaceholderKey(key) {
  if (!key) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(key));
}

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    LLM_PROVIDER: z.enum(['gemini', 'openai', 'groq']).default('gemini'),

    GEMINI_API_KEY: z.string().optional().transform((v) => normalizeKey(v ?? '')),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash-lite'),
    GEMINI_FALLBACK_MODELS: z.string().optional().default(''),

    OPENAI_API_KEY: z.string().optional().transform((v) => normalizeKey(v ?? '')),
    OPENAI_MODEL: z.string().default('gpt-4o-mini'),

    GROQ_API_KEY: z.string().optional().transform((v) => normalizeKey(v ?? '')),
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

    LLM_MAX_TOKENS: z.coerce.number().int().min(500).max(4096).default(2200),
    LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(8).default(5),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    PUBLIC_API_BASE: z.string().optional().default(''),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    DATABASE_PATH: z.string().default('./data/study.db'),
  })
  .superRefine((data, ctx) => {
    if (data.LLM_PROVIDER === 'gemini') {
      if (!data.GEMINI_API_KEY || isPlaceholderKey(data.GEMINI_API_KEY)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GEMINI_API_KEY'],
          message:
            'GEMINI_API_KEY is required for LLM_PROVIDER=gemini. Free key: https://aistudio.google.com/apikey',
        });
      }
    }
    if (data.LLM_PROVIDER === 'openai') {
      if (!data.OPENAI_API_KEY || !data.OPENAI_API_KEY.startsWith('sk-')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OPENAI_API_KEY'],
          message: 'OPENAI_API_KEY (sk-...) is required for LLM_PROVIDER=openai',
        });
      }
    }
    if (data.LLM_PROVIDER === 'groq') {
      if (!data.GROQ_API_KEY || isPlaceholderKey(data.GROQ_API_KEY)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GROQ_API_KEY'],
          message:
            'GROQ_API_KEY is required for LLM_PROVIDER=groq. Free key: https://console.groq.com/keys',
        });
      }
    }
  });

function parseEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Environment validation failed:\n${formatted}`);
    process.exit(1);
  }

  const data = parsed.data;

  if (dotenvResult.error) {
    console.warn(`Note: Could not load ${envPath}`);
  }

  const corsOrigins = data.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  const publicApiBase = data.PUBLIC_API_BASE.replace(/\/$/, '');

  return {
    port: Number(process.env.PORT) || data.PORT,
    nodeEnv: data.NODE_ENV,
    isProduction: data.NODE_ENV === 'production',
    llmProvider: data.LLM_PROVIDER,
    geminiApiKey: data.GEMINI_API_KEY,
    geminiModel: data.GEMINI_MODEL,
    geminiFallbackModels: data.GEMINI_FALLBACK_MODELS.split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    openaiApiKey: data.OPENAI_API_KEY,
    openaiModel: data.OPENAI_MODEL,
    groqApiKey: data.GROQ_API_KEY,
    groqModel: data.GROQ_MODEL,
    llmMaxTokens: data.LLM_MAX_TOKENS,
    llmMaxRetries: data.LLM_MAX_RETRIES,
    corsOrigins,
    publicApiBase,
    rateLimitWindowMs: data.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: data.RATE_LIMIT_MAX,
    databasePath: path.isAbsolute(data.DATABASE_PATH)
      ? data.DATABASE_PATH
      : path.resolve(__dirname, '../..', data.DATABASE_PATH),
  };
}

export const env = parseEnv();
