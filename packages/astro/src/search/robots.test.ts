import { describe, expect, it } from "vitest";
import { robotsTxtOf, SEARCH_CRAWLERS } from "./robots";

describe("robots.txt", () => {
  const text = robotsTxtOf({
    closedPaths: ["/preview", "/seamlet"],
    sitemapUrl: "https://example.ru/sitemap.xml",
  });
  const lines = text.split("\n");

  it("names every crawler in the one group, so none skips the closed parts", () => {
    const agents = lines.filter((line) => line.startsWith("User-agent: "));
    expect(agents).toEqual([
      "User-agent: *",
      ...SEARCH_CRAWLERS.map((crawler) => `User-agent: ${crawler}`),
    ]);
    const firstRule = lines.findIndex((line) => !line.startsWith("User-agent"));
    expect(firstRule).toBe(agents.length);
  });

  it("names the crawlers of search engines and AI assistants", () => {
    expect(SEARCH_CRAWLERS).toEqual(
      expect.arrayContaining([
        "YandexBot",
        "Googlebot",
        "Bingbot",
        "GPTBot",
        "OAI-SearchBot",
        "ChatGPT-User",
        "ClaudeBot",
        "Claude-SearchBot",
        "PerplexityBot",
        "YandexAdditional",
        "Google-Extended",
        "Applebot-Extended",
      ]),
    );
  });

  it("opens the site and closes each closed folder, leaving its neighbours open", () => {
    expect(lines).toContain("Allow: /");
    expect(lines).toEqual(
      expect.arrayContaining([
        "Disallow: /preview$",
        "Disallow: /preview/",
        "Disallow: /seamlet$",
        "Disallow: /seamlet/",
      ]),
    );
    expect(lines).not.toContain("Disallow: /preview");
  });

  it("names the sitemap, or none without one", () => {
    expect(lines).toContain("Sitemap: https://example.ru/sitemap.xml");
    expect(robotsTxtOf({ closedPaths: [] })).not.toContain("Sitemap");
  });
});
