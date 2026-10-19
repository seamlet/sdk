import { readSiteDescription } from "@seamlet/astro/schema";
import { describe, expect, it } from "vitest";
import site from "./seamlet";

describe("the coffee shop as the CMS knows it", () => {
  it("describes itself in a form the CMS reads as it is", () => {
    const sent: unknown = JSON.parse(JSON.stringify(site.description));

    expect(readSiteDescription(sent)).toEqual(site.description);
    expect(site.description.id).toBe("coffee-shop");
    expect(site.description.pages.map((page) => page.path)).toEqual([
      "/",
      "/menu",
    ]);
  });
});
