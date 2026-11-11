export type ExtractionErrorCode =
  | "INVALID_URL"
  | "URL_NOT_ALLOWED"
  | "DNS_LOOKUP_FAILED"
  | "FETCH_TIMEOUT"
  | "FETCH_FAILED"
  | "TOO_MANY_REDIRECTS"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "PAGE_TOO_LARGE"
  | "NO_READABLE_CONTENT"
  | "DATABASE_ERROR";

const statusByCode: Record<ExtractionErrorCode, number> = {
  INVALID_URL: 400,
  URL_NOT_ALLOWED: 400,
  DNS_LOOKUP_FAILED: 502,
  FETCH_TIMEOUT: 504,
  FETCH_FAILED: 502,
  TOO_MANY_REDIRECTS: 502,
  UNSUPPORTED_CONTENT_TYPE: 415,
  PAGE_TOO_LARGE: 413,
  NO_READABLE_CONTENT: 422,
  DATABASE_ERROR: 500,
};

export class ExtractionError extends Error {
  readonly status: number;

  constructor(
    readonly code: ExtractionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ExtractionError";
    this.status = statusByCode[code];
  }
}
