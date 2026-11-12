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

/** The folder at a site's root that holds the copy of the published content and of its uploads. */
export const CONTENT_COPY_FOLDER = "seamlet";

/** The copy of the published content the CMS commits on every publication, from the site's root. */
export const CONTENT_COPY_FILE = `${CONTENT_COPY_FOLDER}/content.json`;

/** The uploads the published content shows, kept beside it under the names the CMS gives them. */
export const CONTENT_COPY_MEDIA_FOLDER = `${CONTENT_COPY_FOLDER}/media`;
