import { z } from "zod";

export const extractionRequestSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL.").max(2_048, "URL is too long."),
});

export const extractionResponseSchema = z.object({
  id: z.uuid(),
  pageTitle: z.string().nullable(),
  sourceUrl: z.url(),
  requestedUrl: z.url(),
  extractedText: z.string(),
  characterCount: z.number().int().nonnegative(),
  wasTruncated: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const extractionEnvelopeSchema = z.object({
  data: extractionResponseSchema,
});

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ExtractionRequest = z.infer<typeof extractionRequestSchema>;
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
