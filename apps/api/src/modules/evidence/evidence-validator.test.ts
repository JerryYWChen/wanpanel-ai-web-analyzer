import { describe, expect, it } from "vitest";
import type { Analysis } from "@wanpanel/shared";
import { evidenceValidator } from "./evidence-validator.js";

function analysisWithEvidence(evidence: string): Analysis {
  return {
    title: "Example",
    summary: "Summary",
    keyFindings: [{ finding: "Finding", evidence }],
    entities: [],
    datesOrNumbers: [],
    missingInformation: [],
  };
}

describe("evidence verification", () => {
  it("accepts equivalent Unicode compatibility typography", () => {
    const result = evidenceValidator(
      analysisWithEvidence(
        "The official number of exoplanets — planets outside our solar system — confirmed by NASA has reached (and then quickly exceeded) 6,000.",
      ),
      "The oﬃcial number of exoplanets — planets outside our solar system — confirmed by NASA has reached (and then quickly exceeded) 6,000.",
    );

    expect(result).toEqual({
      valid: true,
      unmatchedFindingIndexes: [],
      mismatches: [],
    });
  });

  it("accepts exact evidence with normalized whitespace", () => {
    const result = evidenceValidator(
      analysisWithEvidence("The launch happened in 2026."),
      "The launch\n\n happened   in 2026.",
    );

    expect(result).toEqual({
      valid: true,
      unmatchedFindingIndexes: [],
      mismatches: [],
    });
  });

  it("rejects paraphrased or unsupported evidence", () => {
    const result = evidenceValidator(
      analysisWithEvidence("The launch occurred in 2026."),
      "The launch happened in 2026.",
    );

    expect(result.valid).toBe(false);
    expect(result.unmatchedFindingIndexes).toEqual([0]);
    expect(result.mismatches[0]).toMatchObject({
      findingIndex: 0,
      reason: "likely_paraphrase",
      evidence: "The launch occurred in 2026.",
    });
  });

  it("rejects a preposition change despite high textual similarity", () => {
    const result = evidenceValidator(
      analysisWithEvidence(
        "within thousands of light-years from our solar system",
      ),
      "within thousands of light-years of our solar system",
    );

    expect(result.valid).toBe(false);
    expect(result.unmatchedFindingIndexes).toEqual([0]);
  });

  it("rejects fabricated evidence", () => {
    const result = evidenceValidator(
      analysisWithEvidence("NASA confirmed life on the exoplanet."),
      "NASA catalogs confirmed exoplanets and candidate discoveries.",
    );

    expect(result.valid).toBe(false);
    expect(result.unmatchedFindingIndexes).toEqual([0]);
  });

  it("diagnoses punctuation differences without accepting them", () => {
    const result = evidenceValidator(
      analysisWithEvidence('JavaScript is a "multi-paradigm" language.'),
      "JavaScript is a “multi-paradigm” language.",
    );

    expect(result.valid).toBe(false);
    expect(result.mismatches[0]?.reason).toBe(
      "punctuation_or_typography_difference",
    );
  });

  it("diagnoses case differences without accepting them", () => {
    const result = evidenceValidator(
      analysisWithEvidence("javascript is widely used."),
      "JavaScript is widely used.",
    );

    expect(result.valid).toBe(false);
    expect(result.mismatches[0]?.reason).toBe("case_difference");
  });
});
