import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroIntegration } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import seamlet, { type SeamletOptions } from "./index";

type ConfigSetup = NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>;
type BuildStart = NonNullable<AstroIntegration["hooks"]["astro:build:start"]>;

interface SeamletPlugin {
  readonly resolveId: (id: string) => string | undefined;
  readonly load: (id: string) => string | undefined;
}

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "seamlet-site-"));
  await writeFile(
    join(root, "seamlet.json"),
    JSON.stringify({
      id: "coffee-shop",
      title: "Моя кофейня",
      cms: "https://cms.seamlet.ru",
    }),
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

interface SiteSetup {
  readonly options?: SeamletOptions;
  /** `site` of the Astro config. */
  readonly site?: string;
}

/** Sets the site up as Astro would, and says what the integration added to it. */
async function setUp(setup: SiteSetup = {}) {
  const injectRoute = vi.fn();
  const injectScript = vi.fn();
  const updateConfig = vi.fn();
  const warn = vi.fn();
  const integration = seamlet(setup.options);
  const configSetup = integration.hooks["astro:config:setup"] as ConfigSetup;
  const rootUrl = pathToFileURL(`${root}/`);
  await configSetup({
    config: {
      root: rootUrl,
      site: setup.site,
      publicDir: new URL("public/", rootUrl),
      srcDir: new URL("src/", rootUrl),
    },
    addWatchFile: vi.fn(),
    injectRoute,
    injectScript,
    updateConfig,
  } as unknown as Parameters<ConfigSetup>[0]);

  const [viteConfig] = updateConfig.mock.calls[0] as [
    { vite: { plugins: SeamletPlugin[] } },
  ];
  const [plugin] = viteConfig.vite.plugins;
  if (plugin === undefined) throw new Error("No plugin of the site's modules");
  const configId = plugin.resolveId("virtual:seamlet/config") ?? "";
  const searchId = plugin.resolveId("virtual:seamlet/search") ?? "";
  const buildStart = integration.hooks["astro:build:start"] as BuildStart;
  await buildStart({
    logger: { warn },
  } as unknown as Parameters<BuildStart>[0]);
  return {
    configModule: plugin.load(configId),
    searchModule: plugin.load(searchId),
    warnings: warn.mock.calls,
    siteModule: plugin.resolveId("virtual:seamlet/site"),
    routes: injectRoute.mock.calls.map(
      ([route]) => (route as { pattern: string }).pattern,
    ),
    scripts: injectScript.mock.calls,
  };
}

describe("the integration", () => {
  it("gives the build the site's seamlet.json and module", async () => {
    const { configModule, siteModule } = await setUp();

    expect(configModule).toBe(
      [
        'export const siteId = "coffee-shop";',
        'export const siteTitle = "Моя кофейня";',
        'export const cmsOrigin = "https://cms.seamlet.ru";',
      ].join("\n"),
    );
    expect(siteModule).toBe(join(root, "src", "seamlet.ts"));
  });

  it("takes the CMS from CMS_ORIGIN when it is set and not empty", async () => {
    vi.stubEnv("CMS_ORIGIN", "http://localhost:4321/");
    expect((await setUp()).configModule).toContain(
      'export const cmsOrigin = "http://localhost:4321";',
    );

    vi.stubEnv("CMS_ORIGIN", "");
    expect((await setUp()).configModule).toContain(
      'export const cmsOrigin = "https://cms.seamlet.ru";',
    );
  });

  it("adds the preview, the photos, the description and the bridge's loader", async () => {
    const { routes, scripts } = await setUp();

    expect(routes.slice(0, 4)).toEqual([
      "/preview/[...page]",
      "/media/[site]/[file]",
      "/seamlet/site.json",
      "/seamlet-photos/[...path]",
    ]);
    expect(scripts).toEqual([["page", 'import "@seamlet/astro/client";']]);
  });
});

describe("what the integration serves search engines", () => {
  it("is the sitemap, robots.txt naming it and llms.txt for a site with its address", async () => {
    const { routes, searchModule, warnings } = await setUp({
      site: "https://example.ru",
    });

    expect(routes.slice(4)).toEqual([
      "/sitemap.xml",
      "/robots.txt",
      "/llms.txt",
    ]);
    expect(searchModule).toBe(
      [
        'export const siteUrl = "https://example.ru";',
        'export const sitemapUrl = "https://example.ru/sitemap.xml";',
      ].join("\n"),
    );
    expect(warnings).toEqual([]);
  });

  it("leaves the sitemap out and says why for a site without its address", async () => {
    const { routes, searchModule, warnings } = await setUp();

    expect(routes.slice(4)).toEqual(["/robots.txt", "/llms.txt"]);
    expect(searchModule).toBe(
      [
        "export const siteUrl = undefined;",
        "export const sitemapUrl = undefined;",
      ].join("\n"),
    );
    expect(warnings).toEqual([[expect.stringContaining("set `site`")]]);
  });

  it("leaves out what the site turns off, and names no sitemap it does not serve", async () => {
    const { routes, searchModule, warnings } = await setUp({
      site: "https://example.ru",
      options: { sitemap: false, robots: true, llms: false },
    });

    expect(routes.slice(4)).toEqual(["/robots.txt"]);
    expect(searchModule).toContain("export const sitemapUrl = undefined;");
    expect(warnings).toEqual([]);
  });

  it("leaves a file to the site that has its own", async () => {
    await mkdir(join(root, "public"));
    await writeFile(join(root, "public", "robots.txt"), "User-agent: *");
    await mkdir(join(root, "src", "pages"), { recursive: true });
    await writeFile(join(root, "src", "pages", "sitemap.xml.ts"), "");

    const { routes, warnings } = await setUp({ site: "https://example.ru" });

    expect(routes.slice(4)).toEqual(["/llms.txt"]);
    expect(warnings).toEqual([]);
  });
});
