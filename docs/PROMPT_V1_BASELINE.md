# Prompt V1 Baseline and Minimal Revision

## Purpose

This document preserves the original Prompt V1 and the grounding failures observed before its minimal evidence-instruction revision. The User Prompt, structured-output schema, and deterministic evidence validator were not changed by this revision.

## Original System Prompt V1

```text
You are an AI assistant that analyzes webpage content.

Use ONLY the information provided in the webpage text to generate a factual, structured analysis.

Do not invent information that is not supported by the source.

Preserve the webpage title and generate a concise summary.

For each key finding, provide supporting evidence from the webpage.

Identify important entities mentioned in the webpage.

Extract relevant dates and numerical information from the webpage.

If important information is unavailable, include it in missingInformation.

Return the analysis using the required JSON schema.
```

## Original User Prompt V1

```text
Analyze the following webpage content.

URL: {{url}}

Page Title: {{pageTitle}}

Webpage Content:

{{extractedText}}

Generate:

1. A concise title and summary.

2. Key findings with supporting evidence.

3. Important entities.

4. Dates or numerical information.

5. Important missing information.

Use the required structured output format.
```

## Baseline live result

Source: the stored `JavaScript | MDN` extraction containing 5,700 characters. The exact stored `contentText` was embedded unchanged in the rendered user prompt and was also used for deterministic evidence verification.

Configured model observed during investigation: `gpt-5.6-luna`.

- The first manual V1 run returned nine key findings whose evidence values failed grounding.
- A diagnostic rerun returned seven key findings; all seven failed grounding.
- OpenAI Structured Outputs parsing succeeded.
- Generator-level and service-level Zod validation both succeeded.
- The failure occurred only during deterministic evidence grounding.
- No failed analysis was persisted as a successful analysis.

The diagnostic rerun showed that V1 produced paraphrased or combined evidence. Examples:

| Generated evidence excerpt | Closest source excerpt | Diagnostic result |
| --- | --- | --- |
| `The page identifies the ECMAScript Language Specification... as the relevant standards.` | `The standards for JavaScript are the ECMAScript Language Specification...` | Likely paraphrase |
| `The page explicitly states that JavaScript is not “Interpreted Java” and that the two languages have very different syntax, semantics, and uses.` | `However, the two programming languages have very different syntax, semantics, and use.` | Combined/reworded evidence |
| `The page calls JavaScript a lightweight interpreted or just-in-time compiled language... and states that it is used in environments such as Node.js...` | `JavaScript (JS) is a lightweight interpreted (or just-in-time compiled) programming language with first-class functions.` | Combined passages and paraphrase |

Whitespace normalization did not account for these failures. The full evidence strings were not contiguous substrings of the extracted source.

## Approved minimal revision

Only this sentence changed:

```diff
- For each key finding, provide supporting evidence from the webpage.
+ For each key finding, provide a short, verbatim quote copied directly from the webpage text as supporting evidence. Do not paraphrase or combine separate passages.
```

All other System Prompt V1 instructions remain unchanged. The User Prompt, JSON Schema, evidence acceptance policy, and Prompt V1 version label remain unchanged so the before/after grounding behavior can be compared directly.
