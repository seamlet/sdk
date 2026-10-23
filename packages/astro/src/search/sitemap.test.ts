import { describe, expect, it } from "vitest";
import { sitemapOf } from "./sitemap";

describe("the sitemap", () => {
  it("lists every address once, escaped", () => {
    expect(
      sitemapOf([
        "https://example.ru/",
        "https://example.ru/menu?a=1&b=2",
        "https://example.ru/",
      ]),
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url><loc>https://example.ru/</loc></url>",
        "  <url><loc>https://example.ru/menu?a=1&amp;b=2</loc></url>",
        "</urlset>",
        "",
      ].join("\n"),
    );
  });
});
