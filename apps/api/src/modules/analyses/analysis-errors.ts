export type AnalysisErrorCode =
  | "INVALID_ANALYSIS_REQUEST"
  | "ANALYSIS_NOT_FOUND"
  | "EXTRACTION_NOT_FOUND"
  | "MODEL_CONFIGURATION_ERROR"
  | "MODEL_TIMEOUT"
  | "MODEL_REFUSAL"
  | "MODEL_INCOMPLETE"
  | "MODEL_ERROR"
  | "INVALID_MODEL_OUTPUT"
  | "UNGROUNDED_EVIDENCE"
  | "DATABASE_ERROR";

const statusByCode: Record<AnalysisErrorCode, number> = {
  INVALID_ANALYSIS_REQUEST: 400,
  ANALYSIS_NOT_FOUND: 404,
  EXTRACTION_NOT_FOUND: 404,
  MODEL_CONFIGURATION_ERROR: 503,
  MODEL_TIMEOUT: 504,
  MODEL_REFUSAL: 422,
  MODEL_INCOMPLETE: 502,
  MODEL_ERROR: 502,
  INVALID_MODEL_OUTPUT: 502,
  UNGROUNDED_EVIDENCE: 422,
  DATABASE_ERROR: 500,
};

export class AnalysisError extends Error {
  readonly status: number;

  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AnalysisError";
    this.status = statusByCode[code];
  }
}
