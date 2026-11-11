import express from "express";
import type { AnalysisService } from "./modules/analyses/analysis.service.js";
import type { ExtractionService } from "./modules/extraction/extraction.service.js";
import { createAnalysesRouter } from "./routes/analyses.js";
import { createExtractionsRouter } from "./routes/extractions.js";
import { healthRouter } from "./routes/health.js";

export interface AppDependencies {
  analysisService?: AnalysisService;
  extractionService?: ExtractionService;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/health", healthRouter);
  app.use("/api/analyses", createAnalysesRouter(dependencies.analysisService));
  app.use(
    "/api/extractions",
    createExtractionsRouter(dependencies.extractionService),
  );

  return app;
}
