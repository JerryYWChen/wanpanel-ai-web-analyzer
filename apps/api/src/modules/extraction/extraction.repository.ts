import type { PrismaClient } from "@prisma/client";

export interface ExtractionRecordInput {
  requestedUrl: string;
  finalUrl: string;
  pageTitle: string | null;
  contentText: string;
  contentHash: string;
  charCount: number;
  wasTruncated: boolean;
}

export interface ExtractionRecord {
  id: string;
  createdAt: Date;
}

export interface ExtractionRepository {
  create(input: ExtractionRecordInput): Promise<ExtractionRecord>;
}

export function createPrismaExtractionRepository(
  client: PrismaClient,
): ExtractionRepository {
  return {
    create: (input) =>
      client.extraction.create({
        data: input,
        select: { id: true, createdAt: true },
      }),
  };
}
