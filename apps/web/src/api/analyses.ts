import {
  analysisDetailEnvelopeSchema,
  analysisEnvelopeSchema,
  analysisHistoryEnvelopeSchema,
  apiErrorEnvelopeSchema,
  type AnalysisDetail,
  type AnalysisHistoryItem,
  type AnalysisHistoryPagination,
  type AnalysisResponse,
  type PromptVersion,
} from "@wanpanel/shared";
import { ApiRequestError } from "./errors";

export async function createAnalysis(
  extractionId: string,
  promptVersion: PromptVersion = "v2",
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const response = await fetch("/api/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extractionId, promptVersion }),
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

export async function getAnalysisHistory(
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<{
  items: AnalysisHistoryItem[];
  pagination: AnalysisHistoryPagination;
}> {
  const parameters = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const response = await fetch(`/api/analyses?${parameters}`, {
    ...(signal ? { signal } : {}),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throwApiError(body, "The analysis history could not be loaded.");
  }

  const parsed = analysisHistoryEnvelopeSchema.parse(body);
  return { items: parsed.data, pagination: parsed.pagination };
}

export async function getAnalysisDetail(
  analysisId: string,
  signal?: AbortSignal,
): Promise<AnalysisDetail> {
  const response = await fetch(`/api/analyses/${analysisId}`, {
    ...(signal ? { signal } : {}),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throwApiError(body, "The saved analysis could not be loaded.");
  }

  return analysisDetailEnvelopeSchema.parse(body).data;
}

function throwApiError(body: unknown, fallbackMessage: string): never {
  const parsedError = apiErrorEnvelopeSchema.safeParse(body);
  throw new ApiRequestError(
    parsedError.success ? parsedError.data.error.code : "REQUEST_FAILED",
    parsedError.success ? parsedError.data.error.message : fallbackMessage,
  );
}
