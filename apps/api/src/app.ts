import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import type { AnalysisService } from "./modules/analyses/analysis.service.js";
import type { ExtractionService } from "./modules/extraction/extraction.service.js";
import { createAnalysesRouter } from "./routes/analyses.js";
import { createExtractionsRouter } from "./routes/extractions.js";
import { healthRouter } from "./routes/health.js";
import { env } from "./config/env.js";

const frontendBuildPath = fileURLToPath(
  new URL("../../web/dist/", import.meta.url),
);
const frontendIndexPath = path.join(frontendBuildPath, "index.html");

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

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: {
        code: "API_ROUTE_NOT_FOUND",
        message: "The requested API route was not found.",
      },
    });
  });

  if (env.NODE_ENV === "production") {
    app.use(express.static(frontendBuildPath));
    app.get("/{*frontendPath}", (_request, response, next) => {
      response.sendFile(frontendIndexPath, (error) => {
        if (error) next(error);
      });
    });
  }

  return app;
}
