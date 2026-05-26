import { env } from '../config/env.js';

/** Dev-only: test LLM connectivity without generating a full study guide */
export async function testLlm(_req, res) {
  if (env.isProduction) {
    return res.status(404).json({ success: false, error: { message: 'Not found' } });
  }

  const started = Date.now();

  try {
    if (env.llmProvider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with JSON only: {"ok":true}' }] }],
          generationConfig: { maxOutputTokens: 32, responseMimeType: 'application/json' },
        }),
      });
      const body = await response.json().catch(() => ({}));

      return res.status(200).json({
        success: response.ok,
        data: {
          provider: 'gemini',
          model: env.geminiModel,
          httpStatus: response.status,
          latencyMs: Date.now() - started,
          error: body?.error ?? null,
          sample: body?.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 80) ?? null,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        provider: env.llmProvider,
        message: 'Debug test only implemented for gemini. Check server logs when generating.',
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
}
