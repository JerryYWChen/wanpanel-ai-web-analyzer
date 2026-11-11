import {
  analysisEnvelopeSchema,
  apiErrorEnvelopeSchema,
  type AnalysisResponse,
} from "@wanpanel/shared";
import { ApiRequestError } from "./errors";

export async function createAnalysis(
  extractionId: string,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const response = await fetch("/api/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extractionId, promptVersion: "v1" }),
    ...(signal ? { signal } : {}),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = apiErrorEnvelopeSchema.safeParse(body);
    throw new ApiRequestError(
      parsedError.success ? parsedError.data.error.code : "REQUEST_FAILED",
      parsedError.success
        ? parsedError.data.error.message
        : "The webpage could not be analyzed.",
    );
  }

  return analysisEnvelopeSchema.parse(body).data;
}
