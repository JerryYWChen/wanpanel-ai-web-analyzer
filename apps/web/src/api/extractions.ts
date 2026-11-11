import {
  apiErrorEnvelopeSchema,
  extractionEnvelopeSchema,
  type ExtractionResponse,
} from "@wanpanel/shared";
import { ApiRequestError } from "./errors";

export async function createExtraction(
  url: string,
  signal?: AbortSignal,
): Promise<ExtractionResponse> {
  const response = await fetch("/api/extractions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    ...(signal ? { signal } : {}),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = apiErrorEnvelopeSchema.safeParse(body);
    throw new ApiRequestError(
      parsedError.success ? parsedError.data.error.code : "REQUEST_FAILED",
      parsedError.success
        ? parsedError.data.error.message
        : "The webpage could not be extracted.",
    );
  }

  return extractionEnvelopeSchema.parse(body).data;
}
