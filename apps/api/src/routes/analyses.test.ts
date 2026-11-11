import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { AnalysisError } from "../modules/analyses/analysis-errors.js";
import type { AnalysisService } from "../modules/analyses/analysis.service.js";

describe("POST /api/analyses", () => {
  it("rejects an invalid extraction ID", async () => {
    const service: AnalysisService = { analyze: vi.fn() };

    const response = await request(createApp({ analysisService: service }))
      .post("/api/analyses")
      .send({ extractionId: "not-a-uuid", promptVersion: "v1" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ANALYSIS_REQUEST");
    expect(service.analyze).not.toHaveBeenCalled();
  });

  it("returns a clear missing-extraction error", async () => {
    const service: AnalysisService = {
      analyze: vi
        .fn()
        .mockRejectedValue(
          new AnalysisError(
            "EXTRACTION_NOT_FOUND",
            "The requested extraction was not found.",
          ),
        ),
    };

    const response = await request(createApp({ analysisService: service }))
      .post("/api/analyses")
      .send({
        extractionId: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        promptVersion: "v1",
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("EXTRACTION_NOT_FOUND");
  });

  it("returns a successful analysis envelope", async () => {
    const service: AnalysisService = {
      analyze: vi.fn().mockResolvedValue({
        id: "c8877067-f842-4250-acd9-938695f2d9a3",
        extractionId: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        sourceUrl: "https://example.com/",
        promptVersion: "v1",
        model: "test-model",
        result: {
          title: "Example",
          summary: "Summary",
          keyFindings: [],
          entities: [],
          datesOrNumbers: [],
          missingInformation: [],
        },
        createdAt: "2026-11-10T21:00:00.000Z",
      }),
    };

    const response = await request(createApp({ analysisService: service }))
      .post("/api/analyses")
      .send({
        extractionId: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        promptVersion: "v1",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.promptVersion).toBe("v1");
    expect(response.body.data.model).toBe("test-model");
  });
});
