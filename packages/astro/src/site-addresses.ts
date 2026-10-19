// The addresses and files every site has alike, which the integration, its routes, the build and
// the bridge's loader all name.

/** The site's module, from its root: `defineSeamletSite(…)` as its default export. */
export const SITE_MODULE_FILE = "src/seamlet.ts";

/** Where a site serves the preview the CMS's editor frames: `/preview`, `/preview/menu`. */
export const PREVIEW_PATH = "/preview";

/** Where the photos uploaded in the CMS live, on the CMS and on a site: `/media/<site>/<file>`. */
export const UPLOADS_PATH = "/media";

/** The address of a photo uploaded for the site. */
export function uploadedPhotoPath(siteId: string, fileName: string): string {
  return `${UPLOADS_PATH}/${siteId}/${fileName}`;
}
