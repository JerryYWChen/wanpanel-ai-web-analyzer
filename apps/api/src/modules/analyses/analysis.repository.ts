import {
  AnalysisStatus,
  Prisma,
  PrismaClient,
  PromptVersion as PrismaPromptVersion,
} from "@prisma/client";
import type { Analysis } from "@wanpanel/shared";

export interface AnalysisSource {
  id: string;
  finalUrl: string;
  pageTitle: string | null;
  contentText: string;
}

export interface CompletedAnalysisInput {
  extractionId: string;
  model: string;
  systemPromptSnapshot: string;
  userPromptTemplateSnapshot: string;
  result: Analysis;
  verifiedFindingCount: number;
  latencyMs: number;
}

export interface CreatedAnalysis {
  id: string;
  createdAt: Date;
}

export interface AnalysisRepository {
  findExtraction(id: string): Promise<AnalysisSource | null>;
  createCompleted(input: CompletedAnalysisInput): Promise<CreatedAnalysis>;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function createPrismaAnalysisRepository(
  client: PrismaClient,
): AnalysisRepository {
  return {
    findExtraction: (id) =>
      client.extraction.findUnique({
        where: { id },
        select: {
          id: true,
          finalUrl: true,
          pageTitle: true,
          contentText: true,
        },
      }),
    createCompleted: (input) =>
      client.analysis.create({
        data: {
          extractionId: input.extractionId,
          status: AnalysisStatus.COMPLETED,
          promptVersion: PrismaPromptVersion.V1,
          model: input.model,
          systemPromptSnapshot: input.systemPromptSnapshot,
          userPromptTemplateSnapshot: input.userPromptTemplateSnapshot,
          resultJson: toJson(input.result),
          groundingJson: toJson({
            verifiedFindingCount: input.verifiedFindingCount,
          }),
          latencyMs: input.latencyMs,
        },
        select: { id: true, createdAt: true },
      }),
  };
}
