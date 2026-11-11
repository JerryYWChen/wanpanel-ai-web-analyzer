import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { ExtractionError } from "./extraction-errors.js";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type DnsResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: DnsResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({
    address: record.address,
    family: record.family as 4 | 6,
  }));
};

function normalizedHostname(hostname: string): string {
  const withoutBrackets = hostname.startsWith("[")
    ? hostname.slice(1, -1)
    : hostname;
  return withoutBrackets.toLowerCase().replace(/\.$/, "");
}

export function isPublicIp(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;

  const parsed = ipaddr.parse(address);
  const ipv6 = parsed.kind() === "ipv6" ? (parsed as ipaddr.IPv6) : null;
  const normalized =
    ipv6?.isIPv4MappedAddress() === true ? ipv6.toIPv4Address() : parsed;

  return normalized.range() === "unicast";
}

export async function validatePublicUrl(
  rawUrl: string,
  resolver: DnsResolver = defaultResolver,
): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new ExtractionError("INVALID_URL", "Enter a valid absolute URL.", {
      cause: error,
    });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExtractionError(
      "URL_NOT_ALLOWED",
      "Only HTTP and HTTPS URLs are supported.",
    );
  }

  if (url.username || url.password) {
    throw new ExtractionError(
      "URL_NOT_ALLOWED",
      "URLs containing credentials are not allowed.",
    );
  }

  const hostname = normalizedHostname(url.hostname);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new ExtractionError(
      "URL_NOT_ALLOWED",
      "Local and private network URLs are not allowed.",
    );
  }

  let addresses: ResolvedAddress[];
  const literalFamily = isIP(hostname);

  try {
    addresses = literalFamily
      ? [{ address: hostname, family: literalFamily as 4 | 6 }]
      : await resolver(hostname);
  } catch (error) {
    throw new ExtractionError(
      "DNS_LOOKUP_FAILED",
      "The page hostname could not be resolved.",
      { cause: error },
    );
  }

  if (addresses.length === 0) {
    throw new ExtractionError(
      "DNS_LOOKUP_FAILED",
      "The page hostname did not resolve to an address.",
    );
  }

  if (addresses.some(({ address }) => !isPublicIp(address))) {
    throw new ExtractionError(
      "URL_NOT_ALLOWED",
      "Local, private, and reserved network addresses are not allowed.",
    );
  }

  return {
    url,
    addresses: addresses.slice().sort((left, right) => left.family - right.family),
  };
}
