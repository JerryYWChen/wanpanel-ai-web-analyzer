import { z } from "zod";
import { analysisSchema } from "./analysis-schema.js";

export const promptVersionSchema = z.enum(["v1", "v2"]);
export const analysisStatusSchema = z.enum(["completed", "failed"]);

export const analysisRequestSchema = z.object({
  extractionId: z.uuid(),
  promptVersion: promptVersionSchema,
});

export const analysisResponseSchema = z.object({
  id: z.uuid(),
  extractionId: z.uuid(),
  sourceUrl: z.url(),
  promptVersion: promptVersionSchema,
  model: z.string().min(1),
  result: analysisSchema,
  createdAt: z.iso.datetime(),
});

export const analysisEnvelopeSchema = z.object({
  data: analysisResponseSchema,
});

export const analysisHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const analysisHistoryItemSchema = z.object({
  id: z.uuid(),
  sourceUrl: z.url(),
  pageTitle: z.string().nullable(),
  promptVersion: promptVersionSchema,
  model: z.string().min(1),
  status: analysisStatusSchema,
  createdAt: z.iso.datetime(),
});

export const analysisHistoryPaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(50),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const analysisHistoryEnvelopeSchema = z.object({
  data: z.array(analysisHistoryItemSchema),
  pagination: analysisHistoryPaginationSchema,
});

export const analysisIdSchema = z.uuid();

export const analysisDetailSchema = z.object({
  id: z.uuid(),
  status: analysisStatusSchema,
  promptVersion: promptVersionSchema,
  model: z.string().min(1),
  result: analysisSchema.nullable(),
  promptSnapshots: z.object({
    system: z.string(),
    userTemplate: z.string(),
  }),
  extraction: z.object({
    id: z.uuid(),
    requestedUrl: z.url(),
    sourceUrl: z.url(),
    pageTitle: z.string().nullable(),
    extractedText: z.string(),
    characterCount: z.number().int().nonnegative(),
    wasTruncated: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
  createdAt: z.iso.datetime(),
});

export const analysisDetailEnvelopeSchema = z.object({
  data: analysisDetailSchema,
});

export type AnalysisRequestPayload = z.infer<typeof analysisRequestSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type PromptVersion = z.infer<typeof promptVersionSchema>;
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type AnalysisHistoryQuery = z.infer<typeof analysisHistoryQuerySchema>;
export type AnalysisHistoryItem = z.infer<typeof analysisHistoryItemSchema>;
export type AnalysisHistoryPagination = z.infer<
  typeof analysisHistoryPaginationSchema
>;
export type AnalysisDetail = z.infer<typeof analysisDetailSchema>;
