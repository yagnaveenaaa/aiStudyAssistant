import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { getDatabase, closeDatabase } from './services/storage.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, '../../frontend');

const app = express();

app.set('trust proxy', 1);

const connectSrc = ["'self'", ...env.corsOrigins, 'http://localhost:3000', 'http://127.0.0.1:3000'];
if (env.publicApiBase) {
  connectSrc.push(env.publicApiBase);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        connectSrc,
      },
    },
  })
);

const corsOptions = env.corsOrigins.includes('*') ? { origin: true } : { origin: env.corsOrigins };

app.use(
  cors({
    ...corsOptions,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json({ limit: '16kb' }));

app.get('/config.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('application/javascript');
  res.send(`window.__APP_CONFIG__=${JSON.stringify({ apiBase: env.publicApiBase })};`);
});

const limiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
});

app.use('/api', limiter);
app.use('/api', apiRoutes);

app.use(express.static(frontendPath, { index: 'index.html' }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

getDatabase();

const port = Number(process.env.PORT) || env.port;

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`AI Study Assistant running on port ${port}`);
  console.log(`Environment: ${env.nodeEnv}`);
  console.log(`LLM provider: ${env.llmProvider}`);
  const model =
    env.llmProvider === 'gemini'
      ? env.geminiModel
      : env.llmProvider === 'groq'
        ? env.groqModel
        : env.openaiModel;
  console.log(`LLM model: ${model}`);
  if (env.publicApiBase) {
    console.log(`Public API base: ${env.publicApiBase}`);
  }
});

function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
