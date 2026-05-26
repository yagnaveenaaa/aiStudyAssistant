import { explainTopic, fetchHistory, fetchSession } from './api.js';
import { renderStudyContent, formatDate } from './render.js';

const form = document.getElementById('study-form');
const topicInput = document.getElementById('topic');
const levelSelect = document.getElementById('level');
const focusSelect = document.getElementById('focus');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const historyToggle = document.getElementById('history-toggle');
const historyClose = document.getElementById('history-close');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');

let submitCooldownUntil = 0;
let cooldownTimerId = null;

function setStatus(message, type = 'loading') {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = `status status--${type}`;
}

function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = '';
  statusEl.className = 'status';
}

function isOnCooldown() {
  return Date.now() < submitCooldownUntil;
}

function startCooldown(seconds = 120) {
  submitCooldownUntil = Date.now() + seconds * 1000;
  if (cooldownTimerId) clearInterval(cooldownTimerId);
  cooldownTimerId = setInterval(() => {
    if (!isOnCooldown()) {
      clearInterval(cooldownTimerId);
      cooldownTimerId = null;
      submitBtn.textContent = 'Generate study guide';
      submitBtn.disabled = false;
      return;
    }
    const left = Math.ceil((submitCooldownUntil - Date.now()) / 1000);
    submitBtn.textContent = `Wait ${left}s…`;
  }, 1000);
}

function setLoading(loading) {
  const cooldown = isOnCooldown();
  submitBtn.disabled = loading || cooldown;
  topicInput.disabled = loading;
  levelSelect.disabled = loading;
  focusSelect.disabled = loading;
  if (!cooldown && !loading) {
    submitBtn.textContent = 'Generate study guide';
  } else if (loading && !cooldown) {
    submitBtn.textContent = 'Generating…';
  }
}

function showResults(data) {
  renderStudyContent(resultsEl, data);
  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openHistory() {
  historyPanel.hidden = false;
  historyToggle.setAttribute('aria-expanded', 'true');
  loadHistory();
}

function closeHistory() {
  historyPanel.hidden = true;
  historyToggle.setAttribute('aria-expanded', 'false');
}

async function loadHistory() {
  historyList.innerHTML = '';
  historyEmpty.hidden = true;

  try {
    const { data: sessions } = await fetchHistory();

    if (!sessions?.length) {
      historyEmpty.hidden = false;
      return;
    }

    sessions.forEach((session) => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'history-item__btn';

      const topicSpan = document.createElement('span');
      topicSpan.className = 'history-item__topic';
      topicSpan.textContent = session.topic;

      const metaSpan = document.createElement('span');
      metaSpan.className = 'history-item__meta';
      metaSpan.textContent = `${session.level} · ${formatDate(session.createdAt)}`;

      btn.append(topicSpan, metaSpan);

      btn.addEventListener('click', () => loadSession(session.id));
      li.appendChild(btn);
      historyList.appendChild(li);
    });
  } catch (err) {
    historyEmpty.textContent = err.message ?? 'Could not load history';
    historyEmpty.hidden = false;
  }
}

async function loadSession(id) {
  setLoading(true);
  setStatus('Loading saved session…', 'loading');
  closeHistory();

  try {
    const { data } = await fetchSession(id);
    clearStatus();
    showResults(data.content);
    topicInput.value = data.topic ?? '';
    if (data.level) levelSelect.value = data.level;
    if (data.focus) focusSelect.value = data.focus;
  } catch (err) {
    setStatus(err.message ?? 'Failed to load session', 'error');
    resultsEl.hidden = true;
  } finally {
    setLoading(false);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isOnCooldown()) return;

  const topic = topicInput.value.trim();
  if (topic.length < 3) return;

  setLoading(true);
  resultsEl.hidden = true;
  setStatus('Generating your study guide. This may take a moment…', 'loading');

  try {
    const response = await explainTopic({
      topic,
      level: levelSelect.value,
      focus: focusSelect.value,
    });

    clearStatus();
    showResults(response.data);

    if (response.meta?.cached) {
      setStatus('Loaded from your saved history (no new API call).', 'loading');
      setTimeout(clearStatus, 4000);
    }
  } catch (err) {
    const msg = err.message ?? 'Something went wrong';
    const details =
      err.details && typeof err.details === 'object'
        ? ` [${err.code}: model=${err.details.model ?? '?'}]`
        : err.code
          ? ` [${err.code}]`
          : '';
    const isQuota = err.code === 'LLM_QUOTA_EXCEEDED' || err.code === 'OPENAI_QUOTA_EXCEEDED';
    const isOverloaded = err.code === 'LLM_OVERLOADED' || err.status === 503;
    const isRateLimit =
      err.code === 'LLM_RATE_LIMIT' ||
      err.code === 'OPENAI_RATE_LIMIT' ||
      err.status === 429;

    if (isQuota || isRateLimit || isOverloaded) {
      startCooldown(isOverloaded ? 45 : isQuota ? 30 : 60);
      setStatus(`${msg}${details}`, 'error');
    } else {
      setStatus(`${msg}${details}`, 'error');
    }
    console.error('Study guide error:', err);
    resultsEl.hidden = true;
  } finally {
    setLoading(false);
  }
});

historyToggle.addEventListener('click', () => {
  if (historyPanel.hidden) {
    openHistory();
  } else {
    closeHistory();
  }
});

historyClose.addEventListener('click', closeHistory);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !historyPanel.hidden) {
    closeHistory();
  }
});
