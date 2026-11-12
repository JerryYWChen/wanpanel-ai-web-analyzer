import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  analysisDetailEnvelopeSchema,
  analysisHistoryEnvelopeSchema,
} from "@wanpanel/shared";
import { createApp } from "../app.js";
import { AnalysisError } from "../modules/analyses/analysis-errors.js";
import type { AnalysisService } from "../modules/analyses/analysis.service.js";

function createService(
  overrides: Partial<AnalysisService> = {},
): AnalysisService {
  return {
    analyze: vi.fn(),
    listHistory: vi.fn(),
    getAnalysis: vi.fn(),
    ...overrides,
  };
}

describe("GET /api/analyses", () => {
  it("enforces pagination boundaries", async () => {
    const service = createService();

    const invalidPage = await request(createApp({ analysisService: service }))
      .get("/api/analyses")
      .query({ page: 0, limit: 20 });
    const excessiveLimit = await request(
      createApp({ analysisService: service }),
    )
      .get("/api/analyses")
      .query({ page: 1, limit: 51 });

    expect(invalidPage.status).toBe(400);
    expect(excessiveLimit.status).toBe(400);
    expect(service.listHistory).not.toHaveBeenCalled();
  });

  it("returns empty history with default pagination", async () => {
    const service = createService({
      listHistory: vi.fn().mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    });

    const response = await request(createApp({ analysisService: service })).get(
      "/api/analyses",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(analysisHistoryEnvelopeSchema.safeParse(response.body).success).toBe(
      true,
    );
    expect(service.listHistory).toHaveBeenCalledWith(1, 20);
  });

  it("preserves newest-first history ordering", async () => {
    const service = createService({
      listHistory: vi.fn().mockResolvedValue({
        items: [
          {
            id: "c8877067-f842-4250-acd9-938695f2d9a3",
            sourceUrl: "https://example.com/newer",
            pageTitle: "Newer",
            promptVersion: "v2",
            model: "test-model",
            status: "completed",
            createdAt: "2026-11-11T21:00:00.000Z",
          },
          {
            id: "d9977067-f842-4250-acd9-938695f2d9a3",
            sourceUrl: "https://example.com/older",
            pageTitle: "Older",
            promptVersion: "v1",
            model: "test-model",
            status: "completed",
            createdAt: "2026-11-10T21:00:00.000Z",
          },
        ],
        pagination: { page: 1, limit: 2, total: 2, totalPages: 1 },
      }),
    });

    const response = await request(createApp({ analysisService: service }))
      .get("/api/analyses")
      .query({ page: 1, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body.data.map(({ pageTitle }: { pageTitle: string }) => pageTitle)).toEqual([
      "Newer",
      "Older",
    ]);
  });
});

describe("GET /api/analyses/:id", () => {
  it("returns a saved analysis and its extraction", async () => {
    const analysisId = "c8877067-f842-4250-acd9-938695f2d9a3";
    const extractionId = "2c1ad067-1289-4468-a4aa-a461a77c81c5";
    const service = createService({
      getAnalysis: vi.fn().mockResolvedValue({
        id: analysisId,
        status: "completed",
        promptVersion: "v2",
        model: "test-model",
        result: {
          title: "Example",
          summary: "Summary",
          keyFindings: [],
          entities: [],
          datesOrNumbers: [],
          missingInformation: [],
        },
        promptSnapshots: {
          system: "System prompt",
          userTemplate: "User {{extractedText}}",
        },
        extraction: {
          id: extractionId,
          requestedUrl: "https://example.com/requested",
          sourceUrl: "https://example.com/article",
          pageTitle: "Example",
          extractedText: "Stored source content.",
          characterCount: 22,
          wasTruncated: false,
          createdAt: "2026-11-10T20:00:00.000Z",
        },
        createdAt: "2026-11-10T21:00:00.000Z",
      }),
    });

    const response = await request(createApp({ analysisService: service })).get(
      `/api/analyses/${analysisId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: analysisId,
      promptVersion: "v2",
      extraction: {
        id: extractionId,
        extractedText: "Stored source content.",
      },
    });
    expect(analysisDetailEnvelopeSchema.safeParse(response.body).success).toBe(
      true,
    );
    expect(service.getAnalysis).toHaveBeenCalledWith(analysisId);
  });

  it("returns 404 for an unknown analysis ID", async () => {
    const analysisId = "c8877067-f842-4250-acd9-938695f2d9a3";
    const service = createService({
      getAnalysis: vi
        .fn()
        .mockRejectedValue(
          new AnalysisError(
            "ANALYSIS_NOT_FOUND",
            "The requested analysis was not found.",
          ),
        ),
    });

    const response = await request(createApp({ analysisService: service })).get(
      `/api/analyses/${analysisId}`,
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ANALYSIS_NOT_FOUND");
  });
});

describe("POST /api/analyses", () => {
  it("rejects an invalid extraction ID", async () => {
    const service = createService();

    const response = await request(createApp({ analysisService: service }))
      .post("/api/analyses")
      .send({ extractionId: "not-a-uuid", promptVersion: "v1" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ANALYSIS_REQUEST");
    expect(service.analyze).not.toHaveBeenCalled();
  });

  it("rejects an unsupported prompt version", async () => {
    const service = createService();
    const response = await request(createApp({ analysisService: service }))
      .post("/api/analyses")
      .send({
        extractionId: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        promptVersion: "v3",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ANALYSIS_REQUEST");
    expect(service.analyze).not.toHaveBeenCalled();
  });

  it("returns a clear missing-extraction error", async () => {
    const service = createService({
      analyze: vi
        .fn()
        .mockRejectedValue(
          new AnalysisError(
            "EXTRACTION_NOT_FOUND",
            "The requested extraction was not found.",
          ),
        ),
    });

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
    const service = createService({
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
    });

    const response = await request(createApp({ analysisService: service }))
      .post("/api/analyses")
      .send({
        extractionId: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        promptVersion: "v1",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.promptVersion).toBe("v1");
    expect(response.body.data.model).toBe("test-model");
    expect(service.analyze).toHaveBeenCalledWith(
      "2c1ad067-1289-4468-a4aa-a461a77c81c5",
      "v1",
    );
  });

  it("passes V2 selection to the analysis service", async () => {
    const service = createService({
      analyze: vi.fn().mockResolvedValue({
        id: "c8877067-f842-4250-acd9-938695f2d9a3",
        extractionId: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        sourceUrl: "https://example.com/",
        promptVersion: "v2",
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
    });

    const response = await request(createApp({ analysisService: service }))
      .post("/api/analyses")
      .send({
        extractionId: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        promptVersion: "v2",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.promptVersion).toBe("v2");
    expect(service.analyze).toHaveBeenCalledWith(
      "2c1ad067-1289-4468-a4aa-a461a77c81c5",
      "v2",
    );
  });
});
