import { Router } from "express";
import { analysisRequestSchema } from "@wanpanel/shared";
import { AnalysisError } from "../modules/analyses/analysis-errors.js";
import {
  analysisService as defaultAnalysisService,
  type AnalysisService,
} from "../modules/analyses/analysis.service.js";

export function createAnalysesRouter(
  analysisService: AnalysisService = defaultAnalysisService,
) {
  const router = Router();

  router.post("/", async (request, response) => {
    const parsed = analysisRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "INVALID_ANALYSIS_REQUEST",
          message:
            parsed.error.issues[0]?.message ?? "Invalid analysis request.",
        },
      });
      return;
    }

    try {
      const result = await analysisService.analyze(parsed.data.extractionId);
      response.status(201).json({ data: result });
    } catch (error) {
      if (error instanceof AnalysisError) {
        response.status(error.status).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }

      console.error("Unexpected analysis error", error);
      response.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "The webpage could not be analyzed.",
        },
      });
    }
  });

  return router;
}
