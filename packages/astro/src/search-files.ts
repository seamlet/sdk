import { access } from "node:fs/promises";
import { OWN_PHOTOS_PATH } from "./own-photos";
import { SITE_DESCRIPTION_PATH } from "./schema";
import { PREVIEW_PATH } from "./site-addresses";

// The files a site gives search engines and AI assistants, which the integration serves unless the
// site has its own, and the parts of a site no crawler needs.

export const SITEMAP_PATH = "/sitemap.xml";
export const ROBOTS_PATH = "/robots.txt";
export const LLMS_PATH = "/llms.txt";

/** The folder of what a site tells the CMS: `/seamlet` of `/seamlet/site.json`. */
const CMS_FOLDER = SITE_DESCRIPTION_PATH.slice(
  0,
  SITE_DESCRIPTION_PATH.lastIndexOf("/"),
);

/** What serves the CMS and not a visitor: the preview, the description, the own photos for it. */
export const CLOSED_PATHS = [
  PREVIEW_PATH,
  CMS_FOLDER,
  OWN_PHOTOS_PATH,
] as const;

/** The files of a route of Astro that serve an address: `src/pages/robots.txt.ts`. */
const ROUTE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".astro"] as const;

export interface SiteFolders {
  readonly publicDir: URL;
  readonly srcDir: URL;
}

/**
 * Whether the site serves the file at the address itself: from `public/` or from a route of its
 * own in `src/pages/`. The site's own file always wins.
 */
export async function hasOwnFile(
  folders: SiteFolders,
  path: string,
): Promise<boolean> {
  const name = path.slice(1);
  const routes = ROUTE_EXTENSIONS.map(
    (extension) => new URL(`pages/${name}${extension}`, folders.srcDir),
  );
  const candidates = [new URL(name, folders.publicDir), ...routes];
  const found = await Promise.all(candidates.map(exists));
  return found.includes(true);
}

async function exists(file: URL): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    // Not there, or not readable: the site does not serve it from there.
    return false;
  }
}
