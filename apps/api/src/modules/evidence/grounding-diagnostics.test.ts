import { describe, expect, it, vi } from "vitest";
import { createDevelopmentGroundingReporter } from "./grounding-diagnostics.js";

const diagnosticContext = {
  extractionId: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
  sourceUrl: "https://example.com/article?token=redacted#section",
  validation: {
    valid: false,
    unmatchedFindingIndexes: [0],
    mismatches: [
      {
        findingIndex: 0,
        evidence: "Model-generated evidence",
        reason: "likely_paraphrase" as const,
        closestSourceExcerpt: "Closest stored source excerpt",
        tokenOverlap: 0.67,
      },
    ],
  },
};

describe("development grounding diagnostics", () => {
  it("logs safe mismatch previews in development", () => {
    const logger = vi.fn();
    const report = createDevelopmentGroundingReporter("development", logger);

    report(diagnosticContext);

    expect(logger).toHaveBeenCalledWith(
      "Grounding validation failed",
      expect.objectContaining({
        extractionId: diagnosticContext.extractionId,
        sourceUrl: "https://example.com/article",
        mismatches: [
          expect.objectContaining({
            findingNumber: 1,
            evidencePreview: "Model-generated evidence",
            closestSourcePreview: "Closest stored source excerpt",
          }),
        ],
      }),
    );
  });

  it("does not log outside development", () => {
    const logger = vi.fn();
    const report = createDevelopmentGroundingReporter("production", logger);

    report(diagnosticContext);

    expect(logger).not.toHaveBeenCalled();
  });
});
