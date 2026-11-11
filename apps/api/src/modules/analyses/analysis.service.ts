import {
  analysisSchema,
  type AnalysisResponse,
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
import { buildPromptV1 } from "../prompts/prompt-versions.js";
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
  analyze(extractionId: string): Promise<AnalysisResponse>;
}

export function createAnalysisService(
  options: AnalysisServiceOptions,
): AnalysisService {
  return {
    async analyze(extractionId) {
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

      const prompts = buildPromptV1({
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
        const findingNumbers = grounding.unmatchedFindingIndexes
          .map((index) => index + 1)
          .join(", ");
        throw new AnalysisError(
          "UNGROUNDED_EVIDENCE",
          `Evidence for key finding(s) ${findingNumbers} was not found in the extracted webpage text.`,
        );
      }

      let record;
      try {
        record = await options.repository.createCompleted({
          extractionId: source.id,
          model: generated.model,
          systemPromptSnapshot: prompts.system,
          userPromptTemplateSnapshot: prompts.userTemplate,
          result: parsed.data,
          verifiedFindingCount: parsed.data.keyFindings.length,
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
        promptVersion: "v1",
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
