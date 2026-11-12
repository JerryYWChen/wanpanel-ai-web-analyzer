# WanPanel AI Web Content Analyzer

## Overview

An AI-powered web content analyzer built for the WanPanel technical assessment. It securely extracts readable content from public webpages, generates structured analyses through the OpenAI Responses API, and persists results for review and prompt comparison.

- **Live Demo:** [wanpanel-ai-web-analyzer.onrender.com](https://wanpanel-ai-web-analyzer.onrender.com)
- **GitHub:** [JerryYWChen/wanpanel-ai-web-analyzer](https://github.com/JerryYWChen/wanpanel-ai-web-analyzer)

## Features

- **Secure extraction:** HTTP/HTTPS validation, SSRF protection, DNS and redirect revalidation, request limits, Readability extraction, and source preview.
- **Structured analysis:** Zod-validated summaries, key findings, supporting evidence, topics, dates, and missing information.
- **Versioned prompts:** Selectable **V1 Baseline** and **V2 Stable** prompts, with V2 used by default for new analyses.
- **Prompt Inspector:** Read-only access to the saved model, prompt version, System Prompt snapshot, User Prompt template, and structured JSON.
- **Persistent history:** Paginated PostgreSQL history with saved source content and analysis details.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Backend | Node.js, Express 5, TypeScript |
| AI | OpenAI Responses API, Structured Outputs |
| Validation | Shared Zod schemas |
| Extraction | Mozilla Readability, Cheerio, JSDOM |
| Database | Prisma 6, Neon PostgreSQL |
| Deployment | Single Render Web Service |

## Getting Started

Prerequisites: Node.js 20.19+, npm 10+, PostgreSQL 14+ or Neon, and an OpenAI API key with a compatible model.

```bash
git clone https://github.com/JerryYWChen/wanpanel-ai-web-analyzer.git
cd wanpanel-ai-web-analyzer
npm install
cp .env.example .env
```

Configure the required server-side values in `.env`:

```dotenv
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="..."
OPENAI_MODEL="..."
```

Generate Prisma Client, apply the local migration, and start the development environment:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to Express on port `3001`.

Production uses one Express service to serve both `/api/*` and the compiled React application. The Render build command is `npm ci --include=dev && npm run prisma && npm run build`; the start command is `npm run prisma && npm run start --workspace @wanpanel/api`.

## Prompt Engineering & Evaluation

**V1 Baseline** preserves the original concise task framing and direct-evidence requirement. **V2 Stable** adds explicit untrusted-content handling and more selective guidance for summaries, findings, topics, dates, and missing information. Both versions use the same model integration, output schema, validation, and persistence pipeline; “Stable” does not guarantee factual accuracy.

- [V1 prompt implementation](apps/api/src/modules/prompts/v1)
- [V2 prompt implementation](apps/api/src/modules/prompts/v2)
- [V1 baseline history](docs/PROMPT_V1_BASELINE.md)
- [V2 design and evaluation history](docs/PROMPT_V2_DESIGN.md)

Prompt behavior was qualitatively evaluated with stored extractions from [MDN JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript), [NASA Exoplanets](https://science.nasa.gov/exoplanets/), and [MedlinePlus High Blood Pressure](https://medlineplus.gov/highbloodpressure.html).

Zod schema validation is blocking: invalid structured output is rejected. Evidence matching is diagnostic only. Evidence is normalized with Unicode NFKC and whitespace normalization, then checked as a contiguous source substring. A mismatch may be a faithful paraphrase, while an exact match may still support only part of a finding; semantic review remains necessary.

## Testing, Limitations & AI Disclosure

The current automated suite contains **75 passing tests across 16 files**. Run the complete checks with:

```bash
npm test
npm run typecheck
npm run build
```

Key limitations:

- Client-side JavaScript-rendered content may be absent because extraction uses server-returned HTML.
- LLM output can still be incomplete or inaccurate; schema compliance and exact evidence matches do not eliminate hallucinations.
- Analysis history is shared and has no authentication or per-user isolation.
- The public API has no rate limiting, and a Render free-tier deployment may have cold starts after inactivity.

OpenAI ChatGPT and Codex assisted with architecture discussions, implementation, debugging, testing, prompt iteration, deployment preparation, and documentation. The developer reviewed the code and outputs, ran the tests, evaluated prompt behavior, and made the final design decisions.
