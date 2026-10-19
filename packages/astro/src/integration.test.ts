import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroIntegration } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import seamlet from "./index";

type ConfigSetup = NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>;

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
      title: "Кофейня «Зерно»",
      cms: "https://cms.seamlet.ru",
    }),
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

/** Sets the site up as Astro would, and says what the integration added to it. */
async function setUp() {
  const injectRoute = vi.fn();
  const injectScript = vi.fn();
  const updateConfig = vi.fn();
  const setup = seamlet().hooks["astro:config:setup"] as ConfigSetup;
  await setup({
    config: { root: pathToFileURL(`${root}/`) },
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
  return {
    configModule: plugin.load(configId),
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
        'export const siteTitle = "Кофейня «Зерно»";',
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

    expect(routes).toEqual([
      "/preview/[...page]",
      "/media/[site]/[file]",
      "/seamlet/site.json",
      "/seamlet-photos/[...path]",
    ]);
    expect(scripts).toEqual([["page", 'import "@seamlet/astro/client";']]);
  });
});
