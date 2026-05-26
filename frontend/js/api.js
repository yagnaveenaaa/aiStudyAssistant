import { getApiBase } from './config.js';

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.error?.message ?? `Request failed (${response.status})`;
    const code = body?.error?.code ?? 'REQUEST_ERROR';
    const err = new Error(message);
    err.code = code;
    err.status = response.status;
    err.details = body?.error?.details ?? null;
    throw err;
  }

  if (body.success === false) {
    const message = body?.error?.message ?? 'Request failed';
    const err = new Error(message);
    err.code = body?.error?.code ?? 'REQUEST_ERROR';
    throw err;
  }

  return body;
}

function apiUrl(path) {
  const base = getApiBase();
  return `${base}${path}`;
}

async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err instanceof TypeError) {
      const hint =
        'Cannot reach the server. Start the backend (npm run dev in backend/) and open http://localhost:3000 — not Live Server or a file path.';
      const networkErr = new Error(hint);
      networkErr.code = 'NETWORK_ERROR';
      throw networkErr;
    }
    throw err;
  }
}

export async function explainTopic({ topic, level, focus }) {
  const response = await safeFetch(apiUrl('/api/study/explain'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, level, focus }),
  });

  return parseResponse(response);
}

export async function fetchHistory({ limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await safeFetch(apiUrl(`/api/study/history?${params}`));
  return parseResponse(response);
}

export async function fetchSession(id) {
  const response = await safeFetch(apiUrl(`/api/study/history/${id}`));
  return parseResponse(response);
}
