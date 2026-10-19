import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { copyUploadedPhotos } from "./uploaded-photos";
import { OWN_PHOTOS_PATH } from "./own-photos";

// Connects an Astro site to the CMS. The site describes itself in one module (its schema, its id in
// the CMS and its pages), and the integration adds what every site needs alike: the preview the
// CMS's editor frames, the bridge that loads there, and the photos uploaded in the CMS.

export interface SeamletOptions {
  /** The address of the CMS, such as `https://cms.example.com`. */
  readonly cms: string;
  /** The module of the site, relative to the project: `defineSeamletSite(…)` as its default export. */
  readonly site: string;
}

const CONFIG_MODULE = "virtual:seamlet/config";
const SITE_MODULE = "virtual:seamlet/site";
/** Rollup's mark of a module that is not a file. */
const RESOLVED_CONFIG_MODULE = `\0${CONFIG_MODULE}`;

export default function seamlet(options: SeamletOptions): AstroIntegration {
  const cmsOrigin = new URL(options.cms).origin;

  return {
    name: "@seamlet/astro",
    hooks: {
      "astro:config:setup": ({
        config,
        injectRoute,
        injectScript,
        updateConfig,
      }) => {
        const siteModule = fileURLToPath(new URL(options.site, config.root));
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
                    ? `export const cmsOrigin = ${JSON.stringify(cmsOrigin)};`
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
          pattern: `${OWN_PHOTOS_PATH}/[...path]`,
          entrypoint: "@seamlet/astro/routes/own-photos",
          prerender: false,
        });
      },
      // A static host has no route to take the uploaded photos from the CMS on request: the photos
      // the built pages refer to are copied next to them. Pages rendered on request take them
      // through the route above.
      "astro:build:done": async ({ dir, logger }) => {
        const copied = await copyUploadedPhotos({
          directory: fileURLToPath(dir),
          cmsOrigin,
        });
        if (copied > 0) logger.info(`copied ${String(copied)} uploaded photos`);
      },
    },
  };
}
