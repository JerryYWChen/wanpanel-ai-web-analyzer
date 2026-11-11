import { createHash } from "node:crypto";
import type { ExtractionResponse } from "@wanpanel/shared";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { ExtractionError } from "./extraction-errors.js";
import {
  createPrismaExtractionRepository,
  type ExtractionRepository,
} from "./extraction.repository.js";
import { fetchHtml, type FetchHtmlOptions, type FetchedHtml } from "./http-fetcher.js";
import {
  extractReadableContent,
  type ReadableContent,
} from "./readable-extractor.js";
import { truncateAtParagraph } from "./text-normalizer.js";

export interface ExtractionServiceOptions {
  fetch: (url: string, options: FetchHtmlOptions) => Promise<FetchedHtml>;
  parse: (html: Buffer, sourceUrl: string) => ReadableContent;
  repository: ExtractionRepository;
  fetchOptions: FetchHtmlOptions;
  minimumCharacters: number;
  maximumCharacters: number;
}

export interface ExtractionService {
  extract(rawUrl: string): Promise<ExtractionResponse>;
}

export function createExtractionService(
  options: ExtractionServiceOptions,
): ExtractionService {
  return {
    async extract(rawUrl) {
      const fetched = await options.fetch(rawUrl, options.fetchOptions);
      const readable = options.parse(fetched.html, fetched.finalUrl);

      if (readable.text.length < options.minimumCharacters) {
        throw new ExtractionError(
          "NO_READABLE_CONTENT",
          "The page did not contain enough readable content to analyze.",
        );
      }

      const truncated = truncateAtParagraph(
        readable.text,
        options.maximumCharacters,
      );
      const contentHash = createHash("sha256")
        .update(truncated.text)
        .digest("hex");

      let record: { id: string; createdAt: Date };
      try {
        record = await options.repository.create({
          requestedUrl: fetched.requestedUrl,
          finalUrl: fetched.finalUrl,
          pageTitle: readable.title,
          contentText: truncated.text,
          contentHash,
          charCount: truncated.text.length,
          wasTruncated: truncated.wasTruncated,
        });
      } catch (error) {
        throw new ExtractionError(
          "DATABASE_ERROR",
          "The extracted page could not be saved.",
          { cause: error },
        );
      }

      return {
        id: record.id,
        pageTitle: readable.title,
        sourceUrl: fetched.finalUrl,
        requestedUrl: fetched.requestedUrl,
        extractedText: truncated.text,
        characterCount: truncated.text.length,
        wasTruncated: truncated.wasTruncated,
        createdAt: record.createdAt.toISOString(),
      };
    },
  };
}

export const extractionService = createExtractionService({
  fetch: fetchHtml,
  parse: extractReadableContent,
  repository: createPrismaExtractionRepository(prisma),
  fetchOptions: {
    timeoutMs: env.EXTRACTION_TIMEOUT_MS,
    maxBytes: env.EXTRACTION_MAX_HTML_BYTES,
    maxRedirects: 5,
    userAgent: "WanPanelAIContentAnalyzer/0.1 (+public webpage extraction)",
  },
  minimumCharacters: 200,
  maximumCharacters: env.EXTRACTION_MAX_TEXT_CHARS,
});
