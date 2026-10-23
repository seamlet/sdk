import type { APIContext } from "astro";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getLlms } from "./llms";
import { GET as getRobots } from "./robots";
import { GET as getSitemap } from "./sitemap";

interface SearchModule {
  siteUrl: string | undefined;
  sitemapUrl: string | undefined;
}

const search = vi.hoisted((): SearchModule => ({
  siteUrl: "https://example.ru",
  sitemapUrl: "https://example.ru/sitemap.xml",
}));
const published = vi.hoisted(() => ({ load: vi.fn<() => Promise<unknown>>() }));

vi.mock("virtual:seamlet/config", () => ({
  siteId: "cafe",
  siteTitle: "Моя кофейня",
  cmsOrigin: "https://cms.example",
}));
vi.mock("virtual:seamlet/search", () => search);
// A mock is hoisted above the imports: it takes what it needs itself.
vi.mock("virtual:seamlet/site", async () => {
  const {
    collection,
    defineSchema,
    group,
    recordPages,
    seoFields,
    text,
    toggle,
  } = await import("../schema");
  const { defineSeamletSite } = await import("../site");
  const schema = defineSchema({
    seo: group({ label: "Поисковики", fields: { home: seoFields() } }),
    menu: collection({
      label: "Меню",
      itemTitle: "name",
      item: {
        name: text({ label: "Название" }),
        isHidden: toggle({ label: "Скрыть с сайта" }),
      },
    }),
  });
  // The pages are never rendered here: only what lists them is.
  const component = (() => "") as never;
  const site = defineSeamletSite({
    schema,
    initialContent: {
      seo: { home: { title: "", description: "", image: null } },
      menu: [],
    },
    pages: {
      "/": { title: "Главная", component, searchTexts: "seo.home" },
      "/menu": { title: "Меню", component },
    },
    recordPages: [
      {
        pages: recordPages(schema, {
          collection: "menu",
          path: "/menu/[record]",
          shows: (drink) => !drink.isHidden,
        }),
        component,
      },
    ],
  });
  return { default: { ...site, loadPublishedContent: published.load } };
});

const content = {
  seo: {
    home: {
      title: "Кофейня у парка",
      description: "Кофе и завтраки",
      image: null,
    },
  },
  menu: [
    { id: "d1", name: "Латте", isHidden: false },
    { id: "d2", name: "Раф", isHidden: true },
  ],
};

function context(path: string): APIContext {
  return { url: new URL(path, "https://site.example") } as APIContext;
}

afterEach(() => {
  search.siteUrl = "https://example.ru";
  vi.useRealTimers();
});

describe("the routes for search engines", () => {
  it("list the pages the site shows in the sitemap", async () => {
    published.load.mockResolvedValue(content);

    const response = await getSitemap(context("/sitemap.xml"));

    expect(response.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8",
    );
    const sitemap = await response.text();
    expect(sitemap).toContain("<loc>https://example.ru/</loc>");
    expect(sitemap).toContain("<loc>https://example.ru/menu</loc>");
    expect(sitemap).toContain("<loc>https://example.ru/menu/d1</loc>");
    expect(sitemap).not.toContain("d2");
  });

  it("serve no sitemap without the site's address", async () => {
    search.siteUrl = undefined;

    expect((await getSitemap(context("/sitemap.xml"))).status).toBe(404);
  });

  it("write llms.txt of the site's name, its home page and its pages", async () => {
    published.load.mockResolvedValue(content);

    const response = await getLlms(context("/llms.txt"));

    expect(await response.text()).toBe(
      [
        "# Моя кофейня",
        "",
        "> Кофе и завтраки",
        "",
        "## Страницы",
        "",
        "- [Кофейня у парка](https://example.ru/): Кофе и завтраки",
        "- [Меню](https://example.ru/menu)",
        "",
        "## Меню",
        "",
        "- [Латте](https://example.ru/menu/d1)",
        "",
      ].join("\n"),
    );
  });

  it("ask crawlers to come back while the CMS does not answer", async () => {
    // A later time than the content kept by the tests before.
    vi.useFakeTimers({ now: Date.now() + 60_000 });
    published.load.mockRejectedValue(new Error("no answer"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await getLlms(context("/llms.txt"));

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("name the sitemap in robots.txt", async () => {
    const text = await (await getRobots(context("/robots.txt"))).text();

    expect(text).toContain("Disallow: /preview/");
    expect(text).toContain("Disallow: /seamlet/");
    expect(text).toContain("Disallow: /seamlet-photos/");
    expect(text).toContain("Sitemap: https://example.ru/sitemap.xml");
  });
});
