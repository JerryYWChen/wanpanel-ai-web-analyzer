import {
  AnalysisStatus,
  Prisma,
  PrismaClient,
  PromptVersion as PrismaPromptVersion,
} from "@prisma/client";
import type { Analysis, PromptVersion } from "@wanpanel/shared";

export interface AnalysisSource {
  id: string;
  finalUrl: string;
  pageTitle: string | null;
  contentText: string;
}

export interface CompletedAnalysisInput {
  extractionId: string;
  promptVersion: PromptVersion;
  model: string;
  systemPromptSnapshot: string;
  userPromptTemplateSnapshot: string;
  result: Analysis;
  grounding: {
    exactMatchFindingCount: number;
    unmatchedFindingIndexes: number[];
    mismatchReasons: Array<{
      findingIndex: number;
      reason: string;
    }>;
  };
  latencyMs: number;
}

export interface CreatedAnalysis {
  id: string;
  createdAt: Date;
}

export interface AnalysisHistoryRecord {
  id: string;
  status: AnalysisStatus;
  promptVersion: PrismaPromptVersion;
  model: string;
  createdAt: Date;
  extraction: {
    finalUrl: string;
    pageTitle: string | null;
  };
}

export interface AnalysisDetailRecord {
  id: string;
  status: AnalysisStatus;
  promptVersion: PrismaPromptVersion;
  model: string;
  systemPromptSnapshot: string;
  userPromptTemplateSnapshot: string;
  resultJson: Prisma.JsonValue | null;
  createdAt: Date;
  extraction: {
    id: string;
    requestedUrl: string;
    finalUrl: string;
    pageTitle: string | null;
    contentText: string;
    charCount: number;
    wasTruncated: boolean;
    createdAt: Date;
  };
}

export interface AnalysisHistoryPage {
  records: AnalysisHistoryRecord[];
  total: number;
}

export interface AnalysisRepository {
  findExtraction(id: string): Promise<AnalysisSource | null>;
  createCompleted(input: CompletedAnalysisInput): Promise<CreatedAnalysis>;
  listHistory(skip: number, take: number): Promise<AnalysisHistoryPage>;
  findAnalysis(id: string): Promise<AnalysisDetailRecord | null>;
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
          promptVersion:
            input.promptVersion === "v1"
              ? PrismaPromptVersion.V1
              : PrismaPromptVersion.V2,
          model: input.model,
          systemPromptSnapshot: input.systemPromptSnapshot,
          userPromptTemplateSnapshot: input.userPromptTemplateSnapshot,
          resultJson: toJson(input.result),
          groundingJson: toJson(input.grounding),
          latencyMs: input.latencyMs,
        },
        select: { id: true, createdAt: true },
      }),
    async listHistory(skip, take) {
      const [total, records] = await client.$transaction([
        client.analysis.count(),
        client.analysis.findMany({
          skip,
          take,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            promptVersion: true,
            model: true,
            createdAt: true,
            extraction: {
              select: {
                finalUrl: true,
                pageTitle: true,
              },
            },
          },
        }),
      ]);

      return { total, records };
    },
    findAnalysis: (id) =>
      client.analysis.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          promptVersion: true,
          model: true,
          systemPromptSnapshot: true,
          userPromptTemplateSnapshot: true,
          resultJson: true,
          createdAt: true,
          extraction: {
            select: {
              id: true,
              requestedUrl: true,
              finalUrl: true,
              pageTitle: true,
              contentText: true,
              charCount: true,
              wasTruncated: true,
              createdAt: true,
            },
          },
        },
      }),
  };
}
