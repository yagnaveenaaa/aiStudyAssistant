import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    const payload = {
      code: err.code,
      message: err.message,
    };
    if (!env.isProduction && err.details) {
      payload.details = err.details;
    }
    return res.status(err.statusCode).json({
      success: false,
      error: payload,
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
      },
    });
  }

  console.error('[Error]', err);

  const message = env.isProduction ? 'An unexpected error occurred' : err?.message ?? 'Internal server error';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}
