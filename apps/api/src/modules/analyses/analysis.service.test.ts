import { describe, expect, it, vi } from "vitest";
import type { AnalysisGenerator } from "../openai/analysis-generator.js";
import type { AnalysisRepository } from "./analysis.repository.js";
import { createAnalysisService } from "./analysis.service.js";
import { evidenceValidator } from "../evidence/evidence-validator.js";

const extractionId = "2c1ad067-1289-4468-a4aa-a461a77c81c5";

function repositoryWithSource(
  contentText = "The launch happened in 2026.",
): AnalysisRepository {
  return {
    findExtraction: vi.fn().mockResolvedValue({
      id: extractionId,
      finalUrl: "https://example.com/article",
      pageTitle: "Example",
      contentText,
    }),
    createCompleted: vi.fn().mockResolvedValue({
      id: "c8877067-f842-4250-acd9-938695f2d9a3",
      createdAt: new Date("2026-11-10T21:00:00.000Z"),
    }),
  };
}

function generatorWithEvidence(evidence: string): AnalysisGenerator {
  return {
    generate: vi.fn().mockResolvedValue({
      analysis: {
        title: "Example",
        summary: "Summary",
        keyFindings: [{ finding: "A launch occurred.", evidence }],
        entities: [],
        datesOrNumbers: ["2026"],
        missingInformation: [],
      },
      model: "test-model",
      latencyMs: 12,
    }),
  };
}

describe("analysis service", () => {
  it("returns EXTRACTION_NOT_FOUND for a missing source", async () => {
    const repository: AnalysisRepository = {
      findExtraction: vi.fn().mockResolvedValue(null),
      createCompleted: vi.fn(),
    };
    const service = createAnalysisService({
      repository,
      generator: generatorWithEvidence("evidence"),
      validateEvidence: evidenceValidator,
    });

    await expect(service.analyze(extractionId)).rejects.toMatchObject({
      code: "EXTRACTION_NOT_FOUND",
    });
  });

  it("rejects unsupported evidence without saving", async () => {
    const repository = repositoryWithSource();
    const service = createAnalysisService({
      repository,
      generator: generatorWithEvidence(
        "The product launched successfully during 2026.",
      ),
      validateEvidence: evidenceValidator,
    });

    await expect(service.analyze(extractionId)).rejects.toMatchObject({
      code: "UNGROUNDED_EVIDENCE",
    });
    expect(repository.createCompleted).not.toHaveBeenCalled();
  });

  it("stores a grounded V1 result and prompt snapshots", async () => {
    const repository = repositoryWithSource();
    const service = createAnalysisService({
      repository,
      generator: generatorWithEvidence("The launch happened in 2026."),
      validateEvidence: evidenceValidator,
    });

    const result = await service.analyze(extractionId);

    expect(result.promptVersion).toBe("v1");
    expect(result.model).toBe("test-model");
    expect(repository.createCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        extractionId,
        systemPromptSnapshot: expect.stringContaining(
          "You are an AI assistant that analyzes webpage content.",
        ),
        userPromptTemplateSnapshot: expect.stringContaining("{{extractedText}}"),
      }),
    );
  });

  it("uses the identical stored source for the prompt and evidence validation", async () => {
    const sourceText = "Line one with  spacing.\n\nLine two — unchanged.";
    const repository = repositoryWithSource(sourceText);
    const generator: AnalysisGenerator = {
      generate: vi.fn().mockImplementation(({ userPrompt }) => {
        expect(userPrompt).toContain(sourceText);
        return Promise.resolve({
          analysis: {
            title: "Example",
            summary: "Summary",
            keyFindings: [],
            entities: [],
            datesOrNumbers: [],
            missingInformation: [],
          },
          model: "test-model",
          latencyMs: 10,
        });
      }),
    };
    const validateEvidence = vi.fn().mockImplementation((_analysis, source) => {
      expect(source).toBe(sourceText);
      return {
        valid: true,
        unmatchedFindingIndexes: [],
        mismatches: [],
      };
    });
    const service = createAnalysisService({
      repository,
      generator,
      validateEvidence,
    });

    await service.analyze(extractionId);

    expect(generator.generate).toHaveBeenCalledOnce();
    expect(validateEvidence).toHaveBeenCalledOnce();
  });
});
