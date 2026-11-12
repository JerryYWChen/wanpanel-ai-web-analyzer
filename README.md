# WanPanel AI Web Content Analyzer

A two-day take-home project for extracting public webpage content and producing evidence-supported structured analysis. The current build includes secure public-URL extraction, selectable Prompt V1/V2 analysis through the OpenAI Responses API, strict schema validation, non-blocking evidence diagnostics, PostgreSQL persistence, and shared Zod contracts.

## Architecture

This is an npm-workspaces monorepo:

- `apps/web`: React, TypeScript, and Vite. During development, Vite proxies `/api` to Express.
- `apps/api`: Node.js, Express, and TypeScript. It exposes health, extraction, and versioned analysis endpoints.
- `packages/shared`: Zod schemas and inferred TypeScript types shared by browser and server.
- `prisma`: PostgreSQL data model and migrations.

The API keeps extraction, prompts, OpenAI generation, evidence validation, and database access separate. V2 is the current stable default; V1 remains available as the comparison baseline. Both versions use the same schema and evidence diagnostics.

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

Runs Prompt V1 or V2 against a stored extraction:

```json
{
  "extractionId": "2c1ad067-1289-4468-a4aa-a461a77c81c5",
  "promptVersion": "v2"
}
```

The backend retrieves the extraction, calls the OpenAI Responses API with Structured Outputs, and strictly validates the result with the shared Zod schema. It also checks whether every evidence value occurs in the stored source after NFKC and whitespace normalization. Exact-match results are persisted as diagnostic metadata, but a mismatch does not reject an otherwise schema-valid analysis.

### `GET /api/analyses`

Returns saved analyses newest first without source content, result JSON, or prompt snapshots. Query parameters are `page` (default `1`, maximum `10000`) and `limit` (default `20`, maximum `50`). The response includes total records and total pages.

### `GET /api/analyses/:id`

Returns one saved analysis with its structured result, related extraction and source content, model and prompt version, timestamps, and stored System/User Prompt snapshots. Unknown UUIDs return `404`; malformed IDs return `400`.

## Manual prompt comparison

1. Add a valid server-side `OPENAI_API_KEY` and a Structured Outputs-capable `OPENAI_MODEL` to `.env`.
2. Run `npm run dev`.
3. Open `http://localhost:5173`.
4. Extract a public HTML webpage.
5. Run the default **V2 Stable** analysis and save the result for comparison.
6. Keep the same extraction, select **V1 Baseline**, and run the analysis again.
7. Confirm the UI shows every structured field, the configured model, and the selected prompt version.

The exact approved prompt templates are stored under `apps/api/src/modules/prompts/v1/` and `apps/api/src/modules/prompts/v2/`. See `docs/PROMPT_V2_DESIGN.md` for the controlled comparison design.

Stable describes the selected production prompt version, not a guarantee of factual accuracy or semantic grounding. Schema validation remains strict, while evidence-match diagnostics and qualitative review provide complementary signals about output quality.

### Development grounding diagnostics

When `NODE_ENV=development`, an evidence mismatch writes a bounded diagnostic object to the API console. It includes the finding number, mismatch classification, token-overlap score, a truncated model-evidence preview, and a truncated nearest-source preview. Query strings and URL fragments are removed, and the logger never includes API keys, complete prompts, or the full extracted source. Production emits no console diagnostics; text-free mismatch metadata is still stored with the analysis. Diagnostics do not change whether a schema-valid analysis is accepted.

## Current boundaries

Not implemented: deployment, automated evaluation, or optional bonus features. The React application includes read-only analysis history and a Prompt Inspector backed by persisted prompt snapshots. JavaScript-rendered pages are not rendered in a headless browser; only the server-returned HTML is analyzed. Exact evidence matching is a useful signal but cannot determine whether a paraphrase is faithful, so mismatches require evaluation rather than automatic acceptance as verified evidence.
