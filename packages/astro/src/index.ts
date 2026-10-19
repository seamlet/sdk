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
import { loadSiteConfig } from "./site-config-file";

// Connects an Astro site to the CMS. The site names itself in `seamlet.json` at its root (its id and
// title in the CMS, the CMS it belongs to) and describes its content in one module, `src/seamlet.ts`
// (its schema and its pages); the integration adds what every site needs alike: the preview the
// CMS's editor frames, the bridge that loads there, and the photos uploaded in the CMS.

const CONFIG_MODULE = "virtual:seamlet/config";
const SITE_MODULE = "virtual:seamlet/site";
/** Rollup's mark of a module that is not a file. */
const RESOLVED_CONFIG_MODULE = `\0${CONFIG_MODULE}`;
/** The site's module, relative to its root: `defineSeamletSite(…)` as its default export. */
const SITE_MODULE_FILE = "src/seamlet.ts";
/**
 * Takes the place of `cms` of `seamlet.json` when set: a build for another CMS, such as the one in
 * development, or the CMS's builder, which builds a site for itself.
 */
const CMS_ORIGIN_VARIABLE = "CMS_ORIGIN";

export default function seamlet(): AstroIntegration {
  /** Read when the site's config is set up, before the build that needs it. */
  let siteConfig: SiteConfig | undefined;

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
        updateConfig({
          vite: {
            plugins: [
              {
                name: "seamlet-modules",
                resolveId: (id) => {
                  if (id === CONFIG_MODULE) return RESOLVED_CONFIG_MODULE;
                  if (id === SITE_MODULE) return siteModule;
                  return undefined;
                },
                load: (id) =>
                  id === RESOLVED_CONFIG_MODULE
                    ? configModuleOf(loaded)
                    : undefined,
              },
            ],
          },
        });
        // On every page, rendered on request or built: a script of the preview route itself would
        // be left out of a static site's on-demand pages.
        injectScript("page", `import "@seamlet/astro/client";`);
        injectRoute({
          pattern: "/preview/[...page]",
          entrypoint: "@seamlet/astro/routes/preview.astro",
          prerender: false,
        });
        injectRoute({
          pattern: "/media/[site]/[file]",
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

/** `virtual:seamlet/config`: what the site's build takes from `seamlet.json`. */
function configModuleOf(config: SiteConfig): string {
  return [
    `export const siteId = ${JSON.stringify(config.id)};`,
    `export const siteTitle = ${JSON.stringify(config.title)};`,
    `export const cmsOrigin = ${JSON.stringify(config.cms)};`,
  ].join("\n");
}
