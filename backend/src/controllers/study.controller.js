import { env } from '../config/env.js';
import * as studyService from '../services/study.service.js';

export async function explain(req, res, next) {
  try {
    const { topic, level, focus } = req.validated;
    const result = await studyService.explainTopic({ topic, level, focus });

    res.status(200).json({
      success: true,
      data: result.content,
      meta: {
        sessionId: result.sessionId,
        model: result.meta.model,
        generatedAt: result.meta.generatedAt,
        usage: result.meta.usage,
        cached: result.meta.cached ?? false,
      },
    });
  } catch (err) {
    next(err);
  }
}

export function getHistory(req, res, next) {
  try {
    const { limit, offset } = req.validatedQuery;
    const result = studyService.getHistory({ limit, offset });

    res.status(200).json({
      success: true,
      data: result.sessions,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (err) {
    next(err);
  }
}

export function getSession(req, res, next) {
  try {
    const session = studyService.getSessionById(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        topic: session.topic,
        level: session.level,
        focus: session.focus,
        content: session.content,
        model: session.model,
        createdAt: session.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export function health(_req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      llmProvider: env.llmProvider,
    },
  });
}
