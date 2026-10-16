// The modules the integration gives the site's build: what it was configured with.

declare module "virtual:seamlet/config" {
  /** The origin of the CMS: where the content comes from and whose editor may frame the preview. */
  export const cmsOrigin: string;
}

declare module "virtual:seamlet/site" {
  const site: import("./site").SeamletSite;
  export default site;
}
