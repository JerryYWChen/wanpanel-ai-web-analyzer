import type { EvidenceValidationResult } from "./evidence-validator.js";

export interface GroundingDiagnosticContext {
  extractionId: string;
  sourceUrl: string;
  validation: EvidenceValidationResult;
}

export type GroundingDiagnosticsReporter = (
  context: GroundingDiagnosticContext,
) => void;

function preview(value: string | null, maximumLength = 280): string | null {
  if (value === null) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maximumLength
    ? normalized
    : `${normalized.slice(0, maximumLength)}...`;
}

function safeSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "invalid-source-url";
  }
}

export function createDevelopmentGroundingReporter(
  environment: string,
  logger: (message: string, details: unknown) => void = console.warn,
): GroundingDiagnosticsReporter {
  return (context) => {
    if (environment !== "development") return;

    logger("Grounding validation failed", {
      extractionId: context.extractionId,
      sourceUrl: safeSourceUrl(context.sourceUrl),
      mismatches: context.validation.mismatches.map((mismatch) => ({
        findingNumber: mismatch.findingIndex + 1,
        reason: mismatch.reason,
        tokenOverlap: mismatch.tokenOverlap,
        evidencePreview: preview(mismatch.evidence),
        closestSourcePreview: preview(mismatch.closestSourceExcerpt),
      })),
    });
  };
}
