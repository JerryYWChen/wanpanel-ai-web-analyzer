import { z } from "zod";

export const keyFindingSchema = z.object({
  finding: z.string().min(1),
  evidence: z.string().min(1),
});

export const analysisSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  keyFindings: z.array(keyFindingSchema),
  entities: z.array(z.string().min(1)),
  datesOrNumbers: z.array(z.string().min(1)),
  missingInformation: z.array(z.string().min(1)),
});

export type KeyFinding = z.infer<typeof keyFindingSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
