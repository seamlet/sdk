import { describe, expect, it, vi } from "vitest";
import { createContentCache } from "./content-cache";

const FRESH_FOR_MS = 1000;

describe("the kept content", () => {
  it("is loaded once while it is fresh, and anew after", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const cache = createContentCache(load, FRESH_FOR_MS);

    expect(await cache.contentAt(0)).toBe("first");
    expect(await cache.contentAt(FRESH_FOR_MS - 1)).toBe("first");
    expect(await cache.contentAt(FRESH_FOR_MS)).toBe("second");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between those who ask at once", async () => {
    const load = vi.fn(() => Promise.resolve("content"));
    const cache = createContentCache(load, FRESH_FOR_MS);

    await Promise.all([cache.contentAt(0), cache.contentAt(0)]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("asks again after a load that failed", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("no answer"))
      .mockResolvedValueOnce("content");
    const cache = createContentCache(load, FRESH_FOR_MS);

    await expect(cache.contentAt(0)).rejects.toThrow("no answer");
    expect(await cache.contentAt(0)).toBe("content");
  });
});
