import http, { type IncomingHttpHeaders, type RequestOptions } from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { ExtractionError } from "./extraction-errors.js";
import {
  validatePublicUrl,
  type DnsResolver,
  type ResolvedAddress,
} from "./url-policy.js";

export interface FetchHtmlOptions {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  userAgent: string;
  resolver?: DnsResolver;
}

export interface FetchedHtml {
  requestedUrl: string;
  finalUrl: string;
  html: Buffer;
}

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function decoderFor(headers: IncomingHttpHeaders) {
  const encoding = headers["content-encoding"]?.toLowerCase();
  if (encoding === "gzip") return createGunzip();
  if (encoding === "deflate") return createInflate();
  if (encoding === "br") return createBrotliDecompress();
  return null;
}

export function createPinnedLookup(resolved: ResolvedAddress): LookupFunction {
  return ((_hostname, lookupOptions, callback) => {
    if (
      typeof lookupOptions === "object" &&
      lookupOptions !== null &&
      lookupOptions.all
    ) {
      const allCallback = callback as unknown as (
        error: NodeJS.ErrnoException | null,
        addresses: ResolvedAddress[],
      ) => void;
      allCallback(null, [resolved]);
      return;
    }

    const singleCallback = callback as unknown as (
      error: NodeJS.ErrnoException | null,
      address: string,
      family: number,
    ) => void;
    singleCallback(null, resolved.address, resolved.family);
  }) as LookupFunction;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new ExtractionError(
            "FETCH_TIMEOUT",
            "The webpage took too long to respond.",
          ),
        ),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function requestOnce(
  url: URL,
  resolved: ResolvedAddress,
  options: FetchHtmlOptions,
  timeoutMs: number,
): Promise<{
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const requestOptions: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      lookup: createPinnedLookup(resolved),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": options.userAgent,
      },
    };

    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(requestOptions, (response) => {
      const status = response.statusCode ?? 0;

      if (redirectStatuses.has(status)) {
        response.resume();
        resolve({ status, headers: response.headers, body: Buffer.alloc(0) });
        return;
      }

      const contentType = response.headers["content-type"]?.toLowerCase() ?? "";
      if (
        !contentType.startsWith("text/html") &&
        !contentType.startsWith("application/xhtml+xml")
      ) {
        response.resume();
        reject(
          new ExtractionError(
            "UNSUPPORTED_CONTENT_TYPE",
            "The URL did not return an HTML webpage.",
          ),
        );
        return;
      }

      const declaredLength = Number(response.headers["content-length"] ?? 0);
      if (declaredLength > options.maxBytes) {
        response.resume();
        reject(
          new ExtractionError(
            "PAGE_TOO_LARGE",
            "The webpage is too large to process safely.",
          ),
        );
        return;
      }

      const decoder = decoderFor(response.headers);
      const stream = decoder ? response.pipe(decoder) : response;
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      stream.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;

        if (totalBytes > options.maxBytes) {
          stream.destroy(
            new ExtractionError(
              "PAGE_TOO_LARGE",
              "The webpage is too large to process safely.",
            ),
          );
          return;
        }

        chunks.push(buffer);
      });
      stream.once("error", reject);
      stream.once("end", () => {
        resolve({
          status,
          headers: response.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    const timer = setTimeout(() => {
      request.destroy(
        new ExtractionError(
          "FETCH_TIMEOUT",
          "The webpage took too long to respond.",
        ),
      );
    }, timeoutMs);

    request.once("close", () => clearTimeout(timer));
    request.once("error", (error) => {
      clearTimeout(timer);
      reject(
        error instanceof ExtractionError
          ? error
          : new ExtractionError(
              "FETCH_FAILED",
              "The webpage could not be fetched.",
              { cause: error },
            ),
      );
    });
    request.end();
  });
}

export async function fetchHtml(
  rawUrl: string,
  options: FetchHtmlOptions,
): Promise<FetchedHtml> {
  const requestedUrl = rawUrl;
  let currentUrl = rawUrl;
  const deadline = Date.now() + options.timeoutMs;

  for (let redirectCount = 0; redirectCount <= options.maxRedirects; redirectCount += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new ExtractionError(
        "FETCH_TIMEOUT",
        "The webpage took too long to respond.",
      );
    }

    const validated = await withTimeout(
      validatePublicUrl(currentUrl, options.resolver),
      remainingMs,
    );
    let response: Awaited<ReturnType<typeof requestOnce>> | undefined;
    let lastConnectionError: unknown;

    for (const [index, address] of validated.addresses.entries()) {
      const attemptRemainingMs = deadline - Date.now();
      if (attemptRemainingMs <= 0) break;

      try {
        response = await requestOnce(
          validated.url,
          address,
          options,
          Math.max(
            500,
            Math.floor(
              attemptRemainingMs / (validated.addresses.length - index),
            ),
          ),
        );
        break;
      } catch (error) {
        if (
          error instanceof ExtractionError &&
          (error.code === "FETCH_FAILED" || error.code === "FETCH_TIMEOUT")
        ) {
          lastConnectionError = error;
          continue;
        }
        throw error;
      }
    }

    if (!response) {
      throw (
        lastConnectionError ??
        new ExtractionError(
          "FETCH_FAILED",
          "The webpage could not be fetched.",
        )
      );
    }

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.location;
      if (!location) {
        throw new ExtractionError(
          "FETCH_FAILED",
          "The webpage returned an invalid redirect.",
        );
      }

      if (redirectCount === options.maxRedirects) {
        throw new ExtractionError(
          "TOO_MANY_REDIRECTS",
          "The webpage redirected too many times.",
        );
      }

      currentUrl = new URL(location, validated.url).toString();
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new ExtractionError(
        "FETCH_FAILED",
        `The webpage returned HTTP status ${response.status}.`,
      );
    }

    return {
      requestedUrl: new URL(requestedUrl).toString(),
      finalUrl: validated.url.toString(),
      html: response.body,
    };
  }

  throw new ExtractionError(
    "TOO_MANY_REDIRECTS",
    "The webpage redirected too many times.",
  );
}
