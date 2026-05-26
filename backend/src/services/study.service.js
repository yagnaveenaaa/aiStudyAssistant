import { generateStudyContent } from './llm/index.js';
import {
  saveStudySession,
  listStudySessions,
  getStudySessionById,
  findMatchingSession,
} from './storage.service.js';
import { AppError } from '../utils/AppError.js';

export async function explainTopic({ topic, level, focus, forceRefresh = false }) {
  if (!forceRefresh) {
    const existing = findMatchingSession({ topic, level, focus });
    if (existing) {
      return {
        sessionId: existing.id,
        content: existing.content,
        meta: {
          model: existing.model,
          generatedAt: existing.createdAt,
          cached: true,
        },
      };
    }
  }

  const { content, model, usage } = await generateStudyContent({ topic, level, focus });

  const session = saveStudySession({
    topic,
    level,
    focus,
    content,
    model,
  });

  return {
    sessionId: session.id,
    content,
    meta: {
      model,
      generatedAt: session.createdAt,
      usage,
      cached: false,
    },
  };
}

export function getHistory({ limit, offset }) {
  return listStudySessions({ limit, offset });
}

export function getSessionById(id) {
  if (!id || typeof id !== 'string') {
    throw new AppError('Session ID is required', 400, 'VALIDATION_ERROR');
  }

  const session = getStudySessionById(id);

  if (!session) {
    throw new AppError('Study session not found', 404, 'NOT_FOUND');
  }

  return session;
}
