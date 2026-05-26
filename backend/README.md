# AI Study Assistant — Backend

Express API + SQLite history. Generates study content via **Gemini (free)**, Groq, or OpenAI.

## Setup

```bash
npm install
cp .env.example .env
```

### Free trial (recommended)

1. Create a key at [Google AI Studio](https://aistudio.google.com/apikey) (no billing).
2. In `.env`:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...
```

```bash
npm run dev
```

## Environment variables

| Variable | Required when | Description |
|----------|----------------|-------------|
| `LLM_PROVIDER` | Always | `gemini` \| `groq` \| `openai` (default: `gemini`) |
| `GEMINI_API_KEY` | `gemini` | Free Google AI key |
| `GROQ_API_KEY` | `groq` | Free Groq key |
| `OPENAI_API_KEY` | `openai` | OpenAI key (billing required) |
| `LLM_MAX_TOKENS` | No | Default `2200` |
| `PORT` | No | Default `3000` |

## API routes

| Method | Route | Description |
|--------|--------|-------------|
| `GET` | `/api/health` | Health + `llmProvider` |
| `POST` | `/api/study/explain` | Generate study guide |
| `GET` | `/api/study/history` | List sessions |
| `GET` | `/api/study/history/:id` | Get session |

## Deployment

See [../DEPLOYMENT.md](../DEPLOYMENT.md). Set `GEMINI_API_KEY` in Render env for free hosting.
