import type { Analysis } from "@wanpanel/shared";

export interface EvidenceValidationResult {
  valid: boolean;
  unmatchedFindingIndexes: number[];
  mismatches: EvidenceMismatch[];
}

export type EvidenceMismatchReason =
  | "case_difference"
  | "punctuation_or_typography_difference"
  | "likely_paraphrase"
  | "no_close_match";

export interface EvidenceMismatch {
  findingIndex: number;
  evidence: string;
  reason: EvidenceMismatchReason;
  closestSourceExcerpt: string | null;
  tokenOverlap: number;
}

export type EvidenceValidator = (
  analysis: Analysis,
  sourceText: string,
) => EvidenceValidationResult;

export function normalizeEvidenceText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function diagnosticComparable(value: string): string {
  return normalizeEvidenceText(value)
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(
    diagnosticComparable(value)
      .split(" ")
      .filter((token) => token.length > 1),
  );
}

function tokenCoverage(evidence: string, candidate: string): number {
  const evidenceTokens = tokens(evidence);
  if (evidenceTokens.size === 0) return 0;
  const candidateTokens = tokens(candidate);
  let shared = 0;

  for (const token of evidenceTokens) {
    if (candidateTokens.has(token)) shared += 1;
  }

  return shared / evidenceTokens.size;
}

function sourceSegments(sourceText: string): string[] {
  return sourceText
    .split(/\n{2,}|(?<=[.!?])\s+/u)
    .map(normalizeEvidenceText)
    .filter((segment) => segment.length > 0);
}

function diagnoseMismatch(
  findingIndex: number,
  evidence: string,
  normalizedSource: string,
  segments: string[],
): EvidenceMismatch {
  const normalizedEvidence = normalizeEvidenceText(evidence);
  let closestSourceExcerpt: string | null = null;
  let bestCoverage = 0;

  for (const segment of segments) {
    const coverage = tokenCoverage(normalizedEvidence, segment);
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      closestSourceExcerpt = segment;
    }
  }

  let reason: EvidenceMismatchReason;
  if (
    normalizedSource.toLocaleLowerCase().includes(
      normalizedEvidence.toLocaleLowerCase(),
    )
  ) {
    reason = "case_difference";
  } else if (
    diagnosticComparable(normalizedSource).includes(
      diagnosticComparable(normalizedEvidence),
    )
  ) {
    reason = "punctuation_or_typography_difference";
  } else if (bestCoverage >= 0.55) {
    reason = "likely_paraphrase";
  } else {
    reason = "no_close_match";
  }

  return {
    findingIndex,
    evidence,
    reason,
    closestSourceExcerpt,
    tokenOverlap: Number(bestCoverage.toFixed(2)),
  };
}

export const evidenceValidator: EvidenceValidator = (analysis, sourceText) => {
  const normalizedSource = normalizeEvidenceText(sourceText);
  const unmatchedFindingIndexes: number[] = [];
  const mismatches: EvidenceMismatch[] = [];
  const segments = sourceSegments(sourceText);

  analysis.keyFindings.forEach((item, index) => {
    const evidence = normalizeEvidenceText(item.evidence);
    if (!evidence || !normalizedSource.includes(evidence)) {
      unmatchedFindingIndexes.push(index);
      mismatches.push(
        diagnoseMismatch(index, item.evidence, normalizedSource, segments),
      );
    }
  });

  return {
    valid: unmatchedFindingIndexes.length === 0,
    unmatchedFindingIndexes,
    mismatches,
  };
};
