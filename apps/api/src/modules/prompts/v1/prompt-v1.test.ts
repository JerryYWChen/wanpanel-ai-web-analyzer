import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT_V1 } from "./system-prompt.js";
import {
  renderUserPromptV1,
  USER_PROMPT_TEMPLATE_V1,
} from "./user-prompt.js";

describe("Prompt V1", () => {
  it("keeps the approved system prompt unchanged", () => {
    expect(SYSTEM_PROMPT_V1).toBe(`You are an AI assistant that analyzes webpage content.

Use ONLY the information provided in the webpage text to generate a factual, structured analysis.

Do not invent information that is not supported by the source.

Preserve the webpage title and generate a concise summary.

For each key finding, provide a short, verbatim quote copied directly from the webpage text as supporting evidence. Do not paraphrase or combine separate passages.

Identify important entities mentioned in the webpage.

Extract relevant dates and numerical information from the webpage.

If important information is unavailable, include it in missingInformation.

Return the analysis using the required JSON schema.`);
  });

  it("keeps the approved user template and replaces only its placeholders", () => {
    expect(USER_PROMPT_TEMPLATE_V1).toContain("URL: {{url}}");
    expect(USER_PROMPT_TEMPLATE_V1).toContain("Page Title: {{pageTitle}}");
    expect(USER_PROMPT_TEMPLATE_V1).toContain("{{extractedText}}");

    const rendered = renderUserPromptV1({
      url: "https://example.com/article",
      pageTitle: "Example Article",
      extractedText: "Exact source text.",
    });

    expect(rendered).toContain("URL: https://example.com/article");
    expect(rendered).toContain("Page Title: Example Article");
    expect(rendered).toContain("Exact source text.");
    expect(rendered).not.toContain("{{");
  });
});
