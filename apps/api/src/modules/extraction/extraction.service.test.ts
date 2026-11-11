import { describe, expect, it, vi } from "vitest";
import { ExtractionError } from "./extraction-errors.js";
import type { ExtractionRepository } from "./extraction.repository.js";
import { createExtractionService } from "./extraction.service.js";

const fetchOptions = {
  timeoutMs: 100,
  maxBytes: 1_000,
  maxRedirects: 1,
  userAgent: "test",
};

describe("extraction service", () => {
  it("persists a normalized extraction and returns its metadata", async () => {
    const repository: ExtractionRepository = {
      create: vi.fn().mockResolvedValue({
        id: "2c1ad067-1289-4468-a4aa-a461a77c81c5",
        createdAt: new Date("2026-11-10T20:00:00.000Z"),
      }),
    };
    const service = createExtractionService({
      fetch: vi.fn().mockResolvedValue({
        requestedUrl: "https://example.com/",
        finalUrl: "https://example.com/article",
        html: Buffer.from("<html></html>"),
      }),
      parse: vi.fn().mockReturnValue({
        title: "Example",
        text: "A".repeat(240),
      }),
      repository,
      fetchOptions,
      minimumCharacters: 200,
      maximumCharacters: 1_000,
    });

    const result = await service.extract("https://example.com");

    expect(result.pageTitle).toBe("Example");
    expect(result.characterCount).toBe(240);
    expect(result.wasTruncated).toBe(false);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        finalUrl: "https://example.com/article",
        charCount: 240,
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("rejects insufficient content without writing to the database", async () => {
    const repository: ExtractionRepository = { create: vi.fn() };
    const service = createExtractionService({
      fetch: vi.fn().mockResolvedValue({
        requestedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        html: Buffer.from("<html></html>"),
      }),
      parse: vi.fn().mockReturnValue({ title: null, text: "Too short" }),
      repository,
      fetchOptions,
      minimumCharacters: 200,
      maximumCharacters: 1_000,
    });

    await expect(service.extract("https://example.com")).rejects.toMatchObject({
      code: "NO_READABLE_CONTENT",
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("preserves fetch failures and does not persist", async () => {
    const repository: ExtractionRepository = { create: vi.fn() };
    const service = createExtractionService({
      fetch: vi
        .fn()
        .mockRejectedValue(new ExtractionError("FETCH_TIMEOUT", "Timed out.")),
      parse: vi.fn(),
      repository,
      fetchOptions,
      minimumCharacters: 200,
      maximumCharacters: 1_000,
    });

    await expect(service.extract("https://example.com")).rejects.toMatchObject({
      code: "FETCH_TIMEOUT",
    });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
