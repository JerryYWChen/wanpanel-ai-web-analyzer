import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createPrismaAnalysisRepository } from "./analysis.repository.js";

describe("analysis repository history", () => {
  it("queries history newest first with a deterministic tie-breaker", async () => {
    const records = [
      {
        id: "newer",
        status: "COMPLETED",
        promptVersion: "V2",
        model: "test-model",
        createdAt: new Date("2026-11-11T20:00:00.000Z"),
        extraction: {
          finalUrl: "https://example.com/newer",
          pageTitle: "Newer",
        },
      },
      {
        id: "older",
        status: "COMPLETED",
        promptVersion: "V1",
        model: "test-model",
        createdAt: new Date("2026-11-10T20:00:00.000Z"),
        extraction: {
          finalUrl: "https://example.com/older",
          pageTitle: "Older",
        },
      },
    ];
    const count = vi.fn().mockReturnValue(Promise.resolve(2));
    const findMany = vi.fn().mockReturnValue(Promise.resolve(records));
    const transaction = vi.fn().mockResolvedValue([2, records]);
    const client = {
      analysis: { count, findMany },
      $transaction: transaction,
    } as unknown as PrismaClient;
    const repository = createPrismaAnalysisRepository(client);

    const result = await repository.listHistory(20, 10);

    expect(result.records.map(({ id }) => id)).toEqual(["newer", "older"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: expect.objectContaining({
          extraction: {
            select: { finalUrl: true, pageTitle: true },
          },
        }),
      }),
    );
  });

  it("retrieves the extraction relation for analysis detail", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const client = {
      analysis: { findUnique },
    } as unknown as PrismaClient;
    const repository = createPrismaAnalysisRepository(client);

    await repository.findAnalysis("c8877067-f842-4250-acd9-938695f2d9a3");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c8877067-f842-4250-acd9-938695f2d9a3" },
        select: expect.objectContaining({
          extraction: {
            select: expect.objectContaining({
              id: true,
              finalUrl: true,
              contentText: true,
            }),
          },
        }),
      }),
    );
  });
});
