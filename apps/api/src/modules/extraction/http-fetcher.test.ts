import { describe, expect, it, vi } from "vitest";
import { createPinnedLookup } from "./http-fetcher.js";
import type { ResolvedAddress } from "./url-policy.js";

describe("pinned DNS lookup", () => {
  it("returns an address array when Node requests all results", () => {
    const resolved: ResolvedAddress = {
      address: "93.184.216.34",
      family: 4,
    };
    const callback = vi.fn();
    const lookup = createPinnedLookup(resolved) as unknown as (
      hostname: string,
      options: { all: true },
      done: (
        error: NodeJS.ErrnoException | null,
        addresses: ResolvedAddress[],
      ) => void,
    ) => void;

    lookup("example.com", { all: true }, callback);

    expect(callback).toHaveBeenCalledWith(null, [resolved]);
  });

  it("returns one address for the legacy lookup callback", () => {
    const resolved: ResolvedAddress = {
      address: "93.184.216.34",
      family: 4,
    };
    const callback = vi.fn();
    const lookup = createPinnedLookup(resolved) as unknown as (
      hostname: string,
      options: { all: false },
      done: (
        error: NodeJS.ErrnoException | null,
        address: string,
        family: number,
      ) => void,
    ) => void;

    lookup("example.com", { all: false }, callback);

    expect(callback).toHaveBeenCalledWith(null, resolved.address, resolved.family);
  });
});
