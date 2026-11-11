import { z } from "zod";
import { analysisSchema } from "./analysis-schema.js";

export const analysisRequestSchema = z.object({
  extractionId: z.uuid(),
  promptVersion: z.literal("v1"),
});

export const analysisResponseSchema = z.object({
  id: z.uuid(),
  extractionId: z.uuid(),
  sourceUrl: z.url(),
  promptVersion: z.literal("v1"),
  model: z.string().min(1),
  result: analysisSchema,
  createdAt: z.iso.datetime(),
});

export const analysisEnvelopeSchema = z.object({
  data: analysisResponseSchema,
});

export type AnalysisRequestPayload = z.infer<typeof analysisRequestSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
