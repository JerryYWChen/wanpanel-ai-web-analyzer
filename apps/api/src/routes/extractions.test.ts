import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { ExtractionError } from "../modules/extraction/extraction-errors.js";
import type { ExtractionService } from "../modules/extraction/extraction.service.js";

describe("POST /api/extractions", () => {
  it("returns a successful extraction envelope", async () => {
    const service: ExtractionService = {
      extract: vi.fn().mockResolvedValue({
        id: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        pageTitle: "Example",
        sourceUrl: "https://example.com/",
        requestedUrl: "https://example.com/",
        extractedText: "Readable content",
        characterCount: 16,
        wasTruncated: false,
        createdAt: "2026-11-10T20:00:00.000Z",
      }),
    };

    const response = await request(createApp({ extractionService: service }))
      .post("/api/extractions")
      .send({ url: "https://example.com" });

    expect(response.status).toBe(201);
    expect(response.body.data.pageTitle).toBe("Example");
  });

  it("returns a clear validation error for an empty URL", async () => {
    const service: ExtractionService = { extract: vi.fn() };

    const response = await request(createApp({ extractionService: service }))
      .post("/api/extractions")
      .send({ url: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_URL");
    expect(service.extract).not.toHaveBeenCalled();
  });

  it("maps extraction failures to stable public errors", async () => {
    const service: ExtractionService = {
      extract: vi.fn().mockRejectedValue(
        new ExtractionError(
          "UNSUPPORTED_CONTENT_TYPE",
          "The URL did not return an HTML webpage.",
        ),
      ),
    };

    const response = await request(createApp({ extractionService: service }))
      .post("/api/extractions")
      .send({ url: "https://example.com/file.pdf" });

    expect(response.status).toBe(415);
    expect(response.body).toEqual({
      error: {
        code: "UNSUPPORTED_CONTENT_TYPE",
        message: "The URL did not return an HTML webpage.",
      },
    });
  });
});
