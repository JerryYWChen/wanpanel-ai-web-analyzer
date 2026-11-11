import { Router } from "express";
import { extractionRequestSchema } from "@wanpanel/shared";
import { ExtractionError } from "../modules/extraction/extraction-errors.js";
import {
  extractionService as defaultExtractionService,
  type ExtractionService,
} from "../modules/extraction/extraction.service.js";

export function createExtractionsRouter(
  extractionService: ExtractionService = defaultExtractionService,
) {
  const router = Router();

  router.post("/", async (request, response) => {
    const parsed = extractionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "INVALID_URL",
          message: parsed.error.issues[0]?.message ?? "Enter a valid URL.",
        },
      });
      return;
    }

    try {
      const result = await extractionService.extract(parsed.data.url);
      response.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof ExtractionError) {
        response.status(error.status).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }

      console.error("Unexpected extraction error", error);
      response.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "The webpage could not be extracted.",
        },
      });
    }
  });

  return router;
}
