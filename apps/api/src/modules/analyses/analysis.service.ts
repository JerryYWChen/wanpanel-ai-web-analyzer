import {
  analysisSchema,
  type AnalysisDetail,
  type AnalysisHistoryItem,
  type AnalysisHistoryPagination,
  type AnalysisResponse,
  type AnalysisStatus,
  type PromptVersion,
} from "@wanpanel/shared";
import { prisma } from "../../db/prisma.js";
import {
  evidenceValidator as defaultEvidenceValidator,
  type EvidenceValidator,
} from "../evidence/evidence-validator.js";
import {
  createDevelopmentGroundingReporter,
  type GroundingDiagnosticsReporter,
} from "../evidence/grounding-diagnostics.js";
import {
  analysisGenerator as defaultAnalysisGenerator,
  type AnalysisGenerator,
} from "../openai/analysis-generator.js";
import { buildPrompts } from "../prompts/prompt-versions.js";
import { env } from "../../config/env.js";
import { AnalysisError } from "./analysis-errors.js";
import {
  createPrismaAnalysisRepository,
  type AnalysisRepository,
} from "./analysis.repository.js";

export interface AnalysisServiceOptions {
  repository: AnalysisRepository;
  generator: AnalysisGenerator;
  validateEvidence: EvidenceValidator;
  reportGroundingFailure?: GroundingDiagnosticsReporter;
}

export interface AnalysisService {
  analyze(
    extractionId: string,
    promptVersion: PromptVersion,
  ): Promise<AnalysisResponse>;
  listHistory(
    page: number,
    limit: number,
  ): Promise<{
    items: AnalysisHistoryItem[];
    pagination: AnalysisHistoryPagination;
  }>;
  getAnalysis(id: string): Promise<AnalysisDetail>;
}

function toPromptVersion(value: "V1" | "V2"): PromptVersion {
  return value === "V1" ? "v1" : "v2";
}

function toAnalysisStatus(value: "COMPLETED" | "FAILED"): AnalysisStatus {
  return value === "COMPLETED" ? "completed" : "failed";
}

export function createAnalysisService(
  options: AnalysisServiceOptions,
): AnalysisService {
  return {
    async listHistory(page, limit) {
      let history;
      try {
        history = await options.repository.listHistory(
          (page - 1) * limit,
          limit,
        );
      } catch (error) {
        throw new AnalysisError(
          "DATABASE_ERROR",
          "The analysis history could not be loaded.",
          { cause: error },
        );
      }

      return {
        items: history.records.map((record) => ({
          id: record.id,
          sourceUrl: record.extraction.finalUrl,
          pageTitle: record.extraction.pageTitle,
          promptVersion: toPromptVersion(record.promptVersion),
          model: record.model,
          status: toAnalysisStatus(record.status),
          createdAt: record.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total: history.total,
          totalPages: Math.ceil(history.total / limit),
        },
      };
    },

    async getAnalysis(id) {
      let record;
      try {
        record = await options.repository.findAnalysis(id);
      } catch (error) {
        throw new AnalysisError(
          "DATABASE_ERROR",
          "The saved analysis could not be loaded.",
          { cause: error },
        );
      }

      if (!record) {
        throw new AnalysisError(
          "ANALYSIS_NOT_FOUND",
          "The requested analysis was not found.",
        );
      }

      const parsedResult =
        record.resultJson === null
          ? null
          : analysisSchema.safeParse(record.resultJson);
      if (parsedResult !== null && !parsedResult.success) {
        throw new AnalysisError(
          "DATABASE_ERROR",
          "The saved analysis result is invalid.",
          { cause: parsedResult.error },
        );
      }

      return {
        id: record.id,
        status: toAnalysisStatus(record.status),
        promptVersion: toPromptVersion(record.promptVersion),
        model: record.model,
        result: parsedResult === null ? null : parsedResult.data,
        promptSnapshots: {
          system: record.systemPromptSnapshot,
          userTemplate: record.userPromptTemplateSnapshot,
        },
        extraction: {
          id: record.extraction.id,
          requestedUrl: record.extraction.requestedUrl,
          sourceUrl: record.extraction.finalUrl,
          pageTitle: record.extraction.pageTitle,
          extractedText: record.extraction.contentText,
          characterCount: record.extraction.charCount,
          wasTruncated: record.extraction.wasTruncated,
          createdAt: record.extraction.createdAt.toISOString(),
        },
        createdAt: record.createdAt.toISOString(),
      };
    },

    async analyze(extractionId, promptVersion) {
      let source;
      try {
        source = await options.repository.findExtraction(extractionId);
      } catch (error) {
        throw new AnalysisError(
          "DATABASE_ERROR",
          "The source extraction could not be loaded.",
          { cause: error },
        );
      }

      if (!source) {
        throw new AnalysisError(
          "EXTRACTION_NOT_FOUND",
          "The requested extraction was not found.",
        );
      }

      const prompts = buildPrompts(promptVersion, {
        url: source.finalUrl,
        pageTitle: source.pageTitle,
        extractedText: source.contentText,
      });
      const generated = await options.generator.generate({
        systemPrompt: prompts.system,
        userPrompt: prompts.user,
      });
      const parsed = analysisSchema.safeParse(generated.analysis);

      if (!parsed.success) {
        throw new AnalysisError(
          "INVALID_MODEL_OUTPUT",
          "The AI returned output that did not match the required schema.",
          { cause: parsed.error },
        );
      }

      const grounding = options.validateEvidence(parsed.data, source.contentText);
      if (!grounding.valid) {
        options.reportGroundingFailure?.({
          extractionId: source.id,
          sourceUrl: source.finalUrl,
          validation: grounding,
        });
      }

      let record;
      try {
        record = await options.repository.createCompleted({
          extractionId: source.id,
          promptVersion,
          model: generated.model,
          systemPromptSnapshot: prompts.system,
          userPromptTemplateSnapshot: prompts.userTemplate,
          result: parsed.data,
          grounding: {
            exactMatchFindingCount:
              parsed.data.keyFindings.length -
              grounding.unmatchedFindingIndexes.length,
            unmatchedFindingIndexes: grounding.unmatchedFindingIndexes,
            mismatchReasons: grounding.mismatches.map((mismatch) => ({
              findingIndex: mismatch.findingIndex,
              reason: mismatch.reason,
            })),
          },
          latencyMs: generated.latencyMs,
        });
      } catch (error) {
        throw new AnalysisError(
          "DATABASE_ERROR",
          "The completed analysis could not be saved.",
          { cause: error },
        );
      }

      return {
        id: record.id,
        extractionId: source.id,
        sourceUrl: source.finalUrl,
        promptVersion,
        model: generated.model,
        result: parsed.data,
        createdAt: record.createdAt.toISOString(),
      };
    },
  };
}

export const analysisService = createAnalysisService({
  repository: createPrismaAnalysisRepository(prisma),
  generator: defaultAnalysisGenerator,
  validateEvidence: defaultEvidenceValidator,
  reportGroundingFailure: createDevelopmentGroundingReporter(env.NODE_ENV),
});
