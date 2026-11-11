import { describe, expect, it } from "vitest";
import { analysisSchema } from "@wanpanel/shared";

const validAnalysis = {
  title: "Example",
  summary: "A source-grounded summary.",
  keyFindings: [
    { finding: "A supported fact.", evidence: "Exact source evidence." },
  ],
  entities: ["Example Inc."],
  datesOrNumbers: ["2026"],
  missingInformation: [],
};

describe("analysis schema", () => {
  it("accepts the required structured output", () => {
    expect(analysisSchema.safeParse(validAnalysis).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { summary: _summary, ...withoutSummary } = validAnalysis;
    expect(analysisSchema.safeParse(withoutSummary).success).toBe(false);
  });

  it("rejects empty evidence", () => {
    expect(
      analysisSchema.safeParse({
        ...validAnalysis,
        keyFindings: [{ finding: "A fact.", evidence: "" }],
      }).success,
    ).toBe(false);
  });
});
