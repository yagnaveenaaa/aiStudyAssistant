# AI Study Assistant

Topic-based study guides with AI, plus session history.

**Default: Google Gemini (free API key, no billing required).** OpenAI and Groq are also supported.

## Quick start

1. **Get a free Gemini API key** (no credit card): [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

2. **Backend setup**

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
```

3. **Run**

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## LLM providers

| Provider | Cost | Key URL |
|----------|------|---------|
| **gemini** (default) | Free tier | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **groq** | Free tier | [console.groq.com/keys](https://console.groq.com/keys) |
| **openai** | Paid billing | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

Set `LLM_PROVIDER` in `backend/.env` to switch.

## Project layout

```
frontend/     HTML, CSS, vanilla JS
backend/      Express API, SQLite history, LLM providers
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).
