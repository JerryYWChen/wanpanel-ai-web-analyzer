import { Router, type Response } from "express";
import {
  analysisHistoryQuerySchema,
  analysisIdSchema,
  analysisRequestSchema,
} from "@wanpanel/shared";
import { AnalysisError } from "../modules/analyses/analysis-errors.js";
import {
  analysisService as defaultAnalysisService,
  type AnalysisService,
} from "../modules/analyses/analysis.service.js";

function respondWithAnalysisError(
  error: unknown,
  response: Response,
  fallbackMessage: string,
) {
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
      message: fallbackMessage,
    },
  });
}

export function createAnalysesRouter(
  analysisService: AnalysisService = defaultAnalysisService,
) {
  const router = Router();

  router.get("/", async (request, response) => {
    const parsed = analysisHistoryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "INVALID_ANALYSIS_REQUEST",
          message:
            parsed.error.issues[0]?.message ?? "Invalid history request.",
        },
      });
      return;
    }

    try {
      const result = await analysisService.listHistory(
        parsed.data.page,
        parsed.data.limit,
      );
      response.json({ data: result.items, pagination: result.pagination });
    } catch (error) {
      respondWithAnalysisError(
        error,
        response,
        "The analysis history could not be loaded.",
      );
    }
  });

  router.get("/:id", async (request, response) => {
    const parsed = analysisIdSchema.safeParse(request.params.id);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "INVALID_ANALYSIS_REQUEST",
          message: "Invalid analysis ID.",
        },
      });
      return;
    }

    try {
      const result = await analysisService.getAnalysis(parsed.data);
      response.json({ data: result });
    } catch (error) {
      respondWithAnalysisError(
        error,
        response,
        "The saved analysis could not be loaded.",
      );
    }
  });

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
      const result = await analysisService.analyze(
        parsed.data.extractionId,
        parsed.data.promptVersion,
      );
      response.status(201).json({ data: result });
    } catch (error) {
      respondWithAnalysisError(
        error,
        response,
        "The webpage could not be analyzed.",
      );
    }
  });

  return router;
}
