# Prompt V2 Stable Design

## Design goals

Prompt V2 is the current stable production prompt and the default for new analyses. V1 remains selectable as the baseline comparison. V2 separates durable reliability principles from field-specific analysis requirements while preserving the same OpenAI Responses API call, structured-output schema, deterministic evidence validator, and PostgreSQL persistence used by V1.

The webpage text is explicitly described as untrusted source material. This reduces the risk that instructions embedded in a fetched page are treated as application instructions, but it is still a prompt-level control rather than a complete security boundary.

## Prompt responsibility separation

The V2 System Prompt defines the analyzer's role and cross-cutting reliability rules. These rules apply to every output field: source grounding, faithful representation, evidence reliability, uncertainty handling, resistance to instructions embedded in source content, schema compliance, clarity, and relevance. Keeping these principles at the system level makes them authoritative without duplicating every rule in every field instruction.

The V2 User Prompt provides the source variables and task-specific requirements for title, summary, findings, evidence, entities, dates or numbers, and missing information. It tells the model how to populate the existing schema without changing that schema. The three template variables remain `{{url}}`, `{{pageTitle}}`, and `{{extractedText}}` and are rendered by the existing typed prompt builder.

### Core Topics definition for `entities`

The schema field remains named `entities`, but V2 defines its intended content as approximately 3–5 core topics or concepts. Values should be concise topic labels resembling section headings, not an exhaustive named-entity list. Central themes are preferred over incidental people, organizations, tools, names, or technical details, and fewer than three values are acceptable when the source does not support more meaningful topics.

This is a semantic prompt change only. The field remains `string[]`, so the shared JSON schema, Zod validation, API response, persistence format, and React rendering remain unchanged.

## Pre-stabilization evaluation history

Before promotion to stable, V2 was evaluated through controlled prompt iterations while the model, schema, validator, persistence, and source extractions stayed constant. The final iteration refined Key Findings, Evidence, Summary, Dates or Numbers, and Missing Information without changing the shared output schema.

The findings instructions distinguish factual findings and insights from topic descriptions, summary repetition, and generic subject statements. The evidence workflow asks the model to locate a meaningful passage first, formulate one specific and self-contained finding from it, and provide concise evidence drawn from the source. Evidence must faithfully represent the source and must not add fabricated or unsupported details, conclusions, or interpretations.

The stable date rule intentionally uses the existing `datesOrNumbers` field for schema compatibility but asks V2 to return only explicit, meaningful calendar dates directly relevant to the page's central subject. Quantities, percentages, statistics, versions, identifiers, inferred dates, and incidental dates are excluded.

## Controlled differences from V1

| Area | V1 | V2 |
| --- | --- | --- |
| System prompt | Concise baseline instructions | Reliability principles separated from field-level requirements |
| Source handling | Requires source-only factual output | Adds explicit untrusted-content and embedded-instruction handling |
| Summary | Requests a concise summary | Targets 2–3 concise sentences covering the main topic, purpose, and most important takeaway |
| Findings | Requests key findings with evidence | Prioritizes specific factual discoveries, results, explanations, and conclusions rather than topic descriptions or summary repetition |
| Evidence | Requires a short verbatim quote | Uses a passage-first workflow and requires faithful source support without requiring character-for-character quotation |
| Entities | Requests important entities | Defines values as approximately 3–5 concise Core Topics rather than exhaustive named entities |
| Dates or numbers | Requests relevant dates and numbers | Uses a date-only rule while retaining the field name for compatibility; excludes quantities, statistics, inferred dates, and incidental dates |
| Missing information | Requests unavailable important information | Prioritizes meaningful gaps in supporting evidence, methodology, context, or essential explanations |

V2 is now the default for new analyses, while V1 and its version-controlled files remain unchanged for comparison. The model, schema, validator, database design, and API contract remain shared across both versions.

## Expected improvements to evaluate

The pre-stabilization evaluation examined whether findings contained meaningful factual information instead of topic descriptions, whether each finding was supported by its evidence, and whether returned dates were explicit and relevant. Those evaluations informed the stable selection, but exact-match rates remain diagnostic data rather than a complete measure of evidence quality.

The stable designation indicates the version selected for current production use. It does not guarantee factual accuracy, complete evidence support, or semantic grounding. Continued comparison against V1 and qualitative review across representative pages remain appropriate.

## Shared validation and persistence

Both versions use the same shared Zod analysis schema and the same OpenAI Structured Outputs configuration. Schema validation remains a blocking acceptance gate. After schema validation, the application checks each evidence value against the stored extraction using NFKC and whitespace normalization. Exact matches and mismatch classifications are recorded as diagnostics, but a mismatch alone does not reject the analysis or mark that finding as exactly matched.

Successful records store the selected prompt version, configured model, System Prompt snapshot, shared User Prompt template snapshot, structured result, grounding metadata, latency, and source extraction reference. The existing Prisma `PromptVersion` enum already includes `V2`, so no database migration is required.

## Limitations requiring evaluation

- More detailed instructions may increase prompt tokens and latency.
- A model can still produce a schema-valid but low-quality or incomplete analysis.
- Exact substring matching cannot determine whether a paraphrase is faithful or unsupported; mismatches require qualitative review.
- An exact passage may support only part of an over-broad finding, which also requires qualitative review beyond substring matching.
- The prompt-injection instruction reduces risk but cannot prove that all adversarial webpage instructions will be ignored.
- Missing-information judgments are inherently subjective and may vary by page type.
- JavaScript-rendered content absent from the stored extraction remains unavailable to both versions.

## Manual comparison procedure

1. Configure `OPENAI_API_KEY` and a Structured Outputs-capable `OPENAI_MODEL`, then run `npm run dev`.
2. Extract one webpage once so both runs use the same stored extraction ID and source text.
3. Run the default **V2 Stable** analysis. Record the result or inspect the persisted row.
4. Without extracting the page again, select **V1 Baseline** and run the analysis.
5. Compare schema completeness, summary coverage, finding relevance, evidence acceptance, entity selection, contextual dates/numbers, missing-information quality, latency, and any grounding diagnostics.
6. Repeat across several page types before deciding whether V2 performs better.
