import process from "node:process";
import { fileURLToPath } from "node:url";
import type { AstroIntegration, AstroIntegrationLogger } from "astro";
import { unmarkedTextsOfBuild } from "./built-pages";
import {
  PageTextsCheckError,
  reachedTextsLine,
  UNCHECKED_TEXTS_STOP,
  UNREACHED_TEXTS_STOP,
  unmarkedTextsReport,
  type ChecksMode,
  type PageTexts,
} from "./text-checks";
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
/** The adapter whose built server the check of texts renders the pages with. */
const NODE_ADAPTER = "@astrojs/node";

/** What the integration serves for search engines and AI assistants; each is on unless set to false. */
export interface SeamletOptions {
  /** `/sitemap.xml`, the pages the site shows; it needs `site` in the Astro config. */
  readonly sitemap?: boolean;
  /** `/robots.txt`, open to search engines and AI assistants, naming the sitemap. */
  readonly robots?: boolean;
  /** `/llms.txt`, the site's pages for AI assistants with their titles and descriptions. */
  readonly llms?: boolean;
  /**
   * What the build does with the texts of its pages the CMS's editor cannot reach, texts with no
   * field's marker and no `data-cms-fixed`: `"warn"` lists them (the default), `"strict"` stops
   * the build, `"off"` leaves them unchecked.
   */
  readonly checks?: ChecksMode;
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
  /** The built server that renders the pages for the check of texts, with the node adapter. */
  let serverEntry: URL | undefined;
  const checks = options.checks ?? "warn";

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
      "astro:config:done": ({ config }) => {
        const isNodeAdapter = config.adapter?.name === NODE_ADAPTER;
        serverEntry = isNodeAdapter
          ? new URL(config.build.serverEntry, config.build.server)
          : undefined;
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
        await checkPageTexts({ checks, serverEntry, logger });
      },
    },
  };
}

interface PageTextsCheck {
  readonly checks: ChecksMode;
  readonly serverEntry: URL | undefined;
  readonly logger: AstroIntegrationLogger;
}

/**
 * Lists the texts of the built pages the CMS's editor cannot reach; in the strict mode, stops the
 * build when there are any.
 */
async function checkPageTexts(check: PageTextsCheck): Promise<void> {
  const { checks, serverEntry, logger } = check;
  if (checks === "off") return;
  if (serverEntry === undefined) {
    logger.info(
      `the texts of the pages are not checked: the check renders them with the server of ${NODE_ADAPTER}`,
    );
    return;
  }

  const pages = await checkedPageTexts(serverEntry, checks, logger);
  if (pages === undefined) return;

  const report = unmarkedTextsReport(pages);
  if (report === undefined) {
    logger.info(reachedTextsLine(pages));
    return;
  }
  if (checks === "strict") {
    logger.error(report);
    throw new PageTextsCheckError(UNREACHED_TEXTS_STOP);
  }
  logger.warn(report);
}

/**
 * The texts of every built page, or undefined when they could not be rendered, which is reported in
 * their place unless the check is strict: a check that fails never fails a build by itself.
 */
async function checkedPageTexts(
  serverEntry: URL,
  checks: ChecksMode,
  logger: AstroIntegrationLogger,
): Promise<PageTexts[] | undefined> {
  try {
    return await unmarkedTextsOfBuild(serverEntry);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const failure = `the texts of the pages could not be checked: ${reason}`;
    if (checks === "strict") {
      logger.error(failure);
      throw new PageTextsCheckError(UNCHECKED_TEXTS_STOP);
    }
    logger.warn(failure);
    return undefined;
  }
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
