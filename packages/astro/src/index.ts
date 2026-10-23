import process from "node:process";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { copyUploadedPhotos } from "./uploaded-photos";
import { OWN_PHOTOS_PATH } from "./own-photos";
import {
  SITE_CONFIG_FILE,
  SITE_DESCRIPTION_PATH,
  type SiteConfig,
} from "./schema";
import { PREVIEW_PATH, SITE_MODULE_FILE, UPLOADS_PATH } from "./site-addresses";
import { loadSiteConfig } from "./site-config-file";
import {
  hasOwnFile,
  LLMS_PATH,
  ROBOTS_PATH,
  SITEMAP_PATH,
  type SiteFolders,
} from "./search-files";

// Connects an Astro site to the CMS. The site names itself in `seamlet.json` at its root (its id and
// title in the CMS, the CMS it belongs to) and describes its content in one module, `src/seamlet.ts`
// (its schema and its pages); the integration adds what every site needs alike: the preview the
// CMS's editor frames, the bridge that loads there, and the photos uploaded in the CMS, and what
// makes the site found by search engines and AI assistants: the sitemap, robots.txt and llms.txt.

const CONFIG_MODULE = "virtual:seamlet/config";
const SITE_MODULE = "virtual:seamlet/site";
const SEARCH_MODULE = "virtual:seamlet/search";
/** Rollup's mark of a module that is not a file. */
const RESOLVED_CONFIG_MODULE = `\0${CONFIG_MODULE}`;
const RESOLVED_SEARCH_MODULE = `\0${SEARCH_MODULE}`;
/**
 * Takes the place of `cms` of `seamlet.json` when set: a build for another CMS, such as the one in
 * development, or the CMS's builder, which builds a site for itself.
 */
const CMS_ORIGIN_VARIABLE = "CMS_ORIGIN";

/** What the integration serves for search engines and AI assistants; each is on unless set to false. */
export interface SeamletOptions {
  /** `/sitemap.xml`, the pages the site shows; it needs `site` in the Astro config. */
  readonly sitemap?: boolean;
  /** `/robots.txt`, open to search engines and AI assistants, naming the sitemap. */
  readonly robots?: boolean;
  /** `/llms.txt`, the site's pages for AI assistants with their titles and descriptions. */
  readonly llms?: boolean;
}

/** Which of the files for search engines the integration serves. */
interface ServedSearchFiles {
  readonly sitemap: boolean;
  readonly robots: boolean;
  readonly llms: boolean;
}

export default function seamlet(
  options: SeamletOptions = {},
): AstroIntegration {
  /** Read when the site's config is set up, before the build that needs it. */
  let siteConfig: SiteConfig | undefined;
  /** Whether a sitemap was asked for and is not served, as the site sets no `site`. */
  let isSitemapWithoutSite = false;

  return {
    name: "@seamlet/astro",
    hooks: {
      "astro:config:setup": async ({
        config,
        addWatchFile,
        injectRoute,
        injectScript,
        updateConfig,
      }) => {
        const loaded = await loadSiteConfig(
          config.root,
          process.env[CMS_ORIGIN_VARIABLE],
        );
        siteConfig = loaded;
        // The development server starts anew when the file changes.
        addWatchFile(new URL(SITE_CONFIG_FILE, config.root));
        const siteModule = fileURLToPath(
          new URL(SITE_MODULE_FILE, config.root),
        );
        const wanted = await searchFilesWanted(options, config);
        const siteUrl = config.site;
        const served = {
          ...wanted,
          sitemap: wanted.sitemap && siteUrl !== undefined,
        };
        isSitemapWithoutSite = wanted.sitemap && siteUrl === undefined;
        const searchModule = searchModuleOf(siteUrl, served);
        updateConfig({
          vite: {
            plugins: [
              {
                name: "seamlet-modules",
                resolveId: (id) => {
                  if (id === CONFIG_MODULE) return RESOLVED_CONFIG_MODULE;
                  if (id === SEARCH_MODULE) return RESOLVED_SEARCH_MODULE;
                  if (id === SITE_MODULE) return siteModule;
                  return undefined;
                },
                load: (id) => {
                  if (id === RESOLVED_CONFIG_MODULE) {
                    return configModuleOf(loaded);
                  }
                  if (id === RESOLVED_SEARCH_MODULE) return searchModule;
                  return undefined;
                },
              },
            ],
          },
        });
        // On every page, rendered on request or built: a script of the preview route itself would
        // be left out of a static site's on-demand pages.
        injectScript("page", `import "@seamlet/astro/client";`);
        injectRoute({
          pattern: `${PREVIEW_PATH}/[...page]`,
          entrypoint: "@seamlet/astro/routes/preview.astro",
          prerender: false,
        });
        injectRoute({
          pattern: `${UPLOADS_PATH}/[site]/[file]`,
          entrypoint: "@seamlet/astro/routes/media",
          prerender: false,
        });
        injectRoute({
          pattern: SITE_DESCRIPTION_PATH,
          entrypoint: "@seamlet/astro/routes/site-description",
          prerender: false,
        });
        injectRoute({
          pattern: `${OWN_PHOTOS_PATH}/[...path]`,
          entrypoint: "@seamlet/astro/routes/own-photos",
          prerender: false,
        });
        // Rendered on request, from the content published at that moment: a publication reaches
        // them with no new build, as it reaches the pages.
        const searchRoutes = [
          { isServed: served.sitemap, pattern: SITEMAP_PATH, route: "sitemap" },
          { isServed: served.robots, pattern: ROBOTS_PATH, route: "robots" },
          { isServed: served.llms, pattern: LLMS_PATH, route: "llms" },
        ];
        for (const { isServed, pattern, route } of searchRoutes) {
          if (!isServed) continue;
          injectRoute({
            pattern,
            entrypoint: `@seamlet/astro/routes/${route}`,
            prerender: false,
          });
        }
      },
      "astro:build:start": ({ logger }) => {
        if (!isSitemapWithoutSite) return;
        logger.warn(
          `${SITEMAP_PATH} is not served: set \`site\` in the Astro config to the site's address (site: "https://example.ru"), so the sitemap and robots.txt can name its pages; or pass seamlet({ sitemap: false })`,
        );
      },
      // A static host has no route to take the uploaded photos from the CMS on request: the photos
      // the built pages refer to are copied next to them. Pages rendered on request take them
      // through the route above.
      "astro:build:done": async ({ dir, logger }) => {
        if (siteConfig === undefined) return;
        const copied = await copyUploadedPhotos({
          directory: fileURLToPath(dir),
          siteId: siteConfig.id,
          cmsOrigin: siteConfig.cms,
        });
        if (copied > 0) logger.info(`copied ${String(copied)} uploaded photos`);
      },
    },
  };
}

/** The files for search engines the site asks for and does not serve itself. */
async function searchFilesWanted(
  options: SeamletOptions,
  folders: SiteFolders,
): Promise<ServedSearchFiles> {
  const isWanted = async (option: boolean | undefined, path: string) =>
    option !== false && !(await hasOwnFile(folders, path));
  return {
    sitemap: await isWanted(options.sitemap, SITEMAP_PATH),
    robots: await isWanted(options.robots, ROBOTS_PATH),
    llms: await isWanted(options.llms, LLMS_PATH),
  };
}

/** `virtual:seamlet/search`: the site's address, and its sitemap's when it is served. */
function searchModuleOf(
  siteUrl: string | undefined,
  served: ServedSearchFiles,
): string {
  const sitemapUrl =
    siteUrl !== undefined && served.sitemap
      ? new URL(SITEMAP_PATH, siteUrl).href
      : undefined;
  return [
    `export const siteUrl = ${JSON.stringify(siteUrl)};`,
    `export const sitemapUrl = ${JSON.stringify(sitemapUrl)};`,
  ].join("\n");
}

/** `virtual:seamlet/config`: what the site's build takes from `seamlet.json`. */
function configModuleOf(config: SiteConfig): string {
  return [
    `export const siteId = ${JSON.stringify(config.id)};`,
    `export const siteTitle = ${JSON.stringify(config.title)};`,
    `export const cmsOrigin = ${JSON.stringify(config.cms)};`,
  ].join("\n");
}
