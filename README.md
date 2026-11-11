# WanPanel AI Web Content Analyzer

A two-day take-home project for extracting public webpage content and producing evidence-grounded structured analysis. The current build includes secure public-URL extraction, Prompt V1 analysis through the OpenAI Responses API, deterministic evidence verification, PostgreSQL persistence, and shared Zod contracts.

## Architecture

This is an npm-workspaces monorepo:

- `apps/web`: React, TypeScript, and Vite. During development, Vite proxies `/api` to Express.
- `apps/api`: Node.js, Express, and TypeScript. It exposes health, extraction, and Prompt V1 analysis endpoints.
- `packages/shared`: Zod schemas and inferred TypeScript types shared by browser and server.
- `prisma`: PostgreSQL data model and migrations.

The API keeps extraction, prompts, OpenAI generation, evidence validation, and database access separate. Prompt V2 remains intentionally unimplemented.

## Prerequisites

- Node.js 20.19 or newer
- npm 10 or newer
- PostgreSQL 14 or newer, locally or through a hosted provider

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and update `DATABASE_URL` for your PostgreSQL instance. `OPENAI_API_KEY` and `OPENAI_MODEL` can remain empty during Phase 1.

3. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Apply the committed migration after PostgreSQL is available:

   ```bash
   npm run prisma:migrate
   ```

5. Start the shared package watcher, Express API, and Vite UI together:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:5173`. The page should report `API connected: wanpanel-api`. The API can also be checked directly at `http://localhost:3001/api/health`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run shared types, API, and web development servers |
| `npm run build` | Build shared, API, and web workspaces |
| `npm test` | Run focused backend tests |
| `npm run typecheck` | Type-check API and web after building shared contracts |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:validate` | Validate the Prisma schema and environment |
| `npm run prisma:migrate` | Apply migrations and create a new development migration when the schema changes |
| `npm run prisma:deploy` | Apply committed migrations in production |
| `npm run prisma:studio` | Inspect the configured database |

## Environment variables

| Name | Required now | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `PORT` | No | Express port; defaults to `3001` |
| `EXTRACTION_TIMEOUT_MS` | No | Total fetch/redirect timeout; defaults to `10000` |
| `EXTRACTION_MAX_HTML_BYTES` | No | Maximum decompressed response size; defaults to 2 MiB |
| `EXTRACTION_MAX_TEXT_CHARS` | No | Maximum stored/returned readable text; defaults to `60000` |
| `DATABASE_URL` | For Prisma/database commands | PostgreSQL connection string |
| `OPENAI_API_KEY` | For AI analysis | Server-only OpenAI credential; never use a `VITE_` prefix |
| `OPENAI_MODEL` | For AI analysis | Responses API model with Structured Outputs support |
| `OPENAI_TIMEOUT_MS` | No | OpenAI request timeout; defaults to `45000` |

## Current API

### `GET /api/health`

Returns a shared, Zod-validated response:

```json
{
  "status": "ok",
  "service": "wanpanel-api",
  "timestamp": "2026-11-10T00:00:00.000Z"
}
```

### `POST /api/extractions`

Accepts a public HTTP/HTTPS HTML URL:

```json
{ "url": "https://example.com/article" }
```

The API validates DNS results, blocks private/loopback/reserved addresses, pins the validated address for the connection, and repeats those checks for every redirect. Successful responses contain the stored extraction ID, final source URL, title, normalized readable text, character count, and truncation status.

### `POST /api/analyses`

Runs the approved Prompt V1 against a stored extraction:

```json
{
  "extractionId": "2c1ad067-1289-4468-a4aa-a461a77c81c5",
  "promptVersion": "v1"
}
```

The backend retrieves the extraction, calls the OpenAI Responses API with Structured Outputs, validates the result with the shared Zod schema, and checks that every evidence value occurs in the stored source after whitespace normalization. Only grounded successful results are stored. V1 grounding failures are returned without repair or retry.

## Manual Prompt V1 test

1. Add a valid server-side `OPENAI_API_KEY` and a Structured Outputs-capable `OPENAI_MODEL` to `.env`.
2. Run `npm run dev`.
3. Open `http://localhost:5173`.
4. Extract a public HTML webpage.
5. Select **Analyze with AI**.
6. Confirm the UI shows every structured field, the configured model, and `Prompt V1`.

The exact approved prompt templates are stored under `apps/api/src/modules/prompts/v1/`.

### Development grounding diagnostics

When `NODE_ENV=development`, a rejected evidence result writes a bounded diagnostic object to the API console. It includes the finding number, mismatch classification, token-overlap score, a truncated model-evidence preview, and a truncated nearest-source preview. Query strings and URL fragments are removed, and the logger never includes API keys, complete prompts, or the full extracted source. Production emits no grounding diagnostics. These diagnostics do not change whether evidence is accepted.

## Current boundaries

Not yet implemented: Prompt V2, Prompt Inspector, history UI, or optional bonus features. JavaScript-rendered pages are not rendered in a headless browser; only the server-returned HTML is analyzed. Prompt V1 may paraphrase evidence; deterministic verification intentionally rejects that response so its baseline behavior can be measured before V2.
