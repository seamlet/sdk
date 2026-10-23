import type { APIRoute } from "astro";
import { siteUrl } from "virtual:seamlet/search";
import { sitemapOf } from "../search";
import { shownPages, unavailable } from "./search-pages";

// The sitemap: the whole address of every page the site shows, its own and those of the records,
// from the content it published. The integration serves it only when the site names its `site`.

const NOT_FOUND = 404;
/** A new record's page reaches the sitemap within this, as a publication reaches the pages. */
const CACHE_CONTROL = "public, max-age=300";

export const GET: APIRoute = async () => {
  if (siteUrl === undefined) return new Response(null, { status: NOT_FOUND });

  const pages = await shownPages();
  if (pages === undefined) return unavailable();

  const urls = pages.map(({ path }) => new URL(path, siteUrl).href);
  return new Response(sitemapOf(urls), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
};
