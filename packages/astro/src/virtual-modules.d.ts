// The modules the integration gives the site's build: its `seamlet.json` and its module.

declare module "virtual:seamlet/config" {
  /** The site's id in the CMS, from `seamlet.json`. */
  export const siteId: string;
  /** How the CMS names the site, from `seamlet.json`. */
  export const siteTitle: string;
  /** The origin of the CMS: where the content comes from and whose editor may frame the preview. */
  export const cmsOrigin: string;
}

declare module "virtual:seamlet/site" {
  const site: import("./site").SeamletSite;
  export default site;
}

declare module "virtual:seamlet/search" {
  /** The whole address of the site, `site` of its Astro config; undefined when it sets none. */
  export const siteUrl: string | undefined;
  /** The whole address of the sitemap the integration serves; undefined when it serves none. */
  export const sitemapUrl: string | undefined;
}
