import { describe, expect, it, vi } from "vitest";
import { ExtractionError } from "./extraction-errors.js";
import { isPublicIp, validatePublicUrl } from "./url-policy.js";

describe("URL policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.2",
    "169.254.169.254",
    "192.168.1.10",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks non-public address %s", (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it("allows a globally routable address", () => {
    expect(isPublicIp("93.184.216.34")).toBe(true);
    expect(isPublicIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });

  it.each(["file:///etc/passwd", "ftp://example.com/file", "http://localhost"])(
    "rejects disallowed URL %s",
    async (url) => {
      await expect(validatePublicUrl(url)).rejects.toBeInstanceOf(ExtractionError);
    },
  );

  it("rejects hostnames resolving to a private address", async () => {
    const resolver = vi.fn().mockResolvedValue([
      { address: "10.0.0.4", family: 4 as const },
    ]);

    await expect(validatePublicUrl("https://example.com", resolver)).rejects.toMatchObject({
      code: "URL_NOT_ALLOWED",
    });
  });

  it("rejects mixed public/private DNS answers", async () => {
    const resolver = vi.fn().mockResolvedValue([
      { address: "93.184.216.34", family: 4 as const },
      { address: "127.0.0.1", family: 4 as const },
    ]);

    await expect(validatePublicUrl("https://example.com", resolver)).rejects.toMatchObject({
      code: "URL_NOT_ALLOWED",
    });
  });

  it("returns validated public DNS answers", async () => {
    const resolver = vi.fn().mockResolvedValue([
      { address: "93.184.216.34", family: 4 as const },
    ]);

    const result = await validatePublicUrl("https://example.com/article", resolver);

    expect(result.url.toString()).toBe("https://example.com/article");
    expect(result.addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
});
