import {
  healthResponseSchema,
  type HealthResponse,
} from "@wanpanel/shared";

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch("/api/health", signal ? { signal } : undefined);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}.`);
  }

  return healthResponseSchema.parse(await response.json());
}
