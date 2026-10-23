import site from "virtual:seamlet/site";
import { createContentCache, FRESH_FOR_MS } from "../content-cache";
import { searchPagesOf, type SearchPage } from "../search-pages";

// What the sitemap and llms.txt list: the pages the site shows with the content it published,
// kept for a short while, as the site's pages keep it.

const publishedContent = createContentCache(
  () => site.loadPublishedContent(),
  FRESH_FOR_MS,
);

/** A crawler asks again later when the CMS does not answer: a minute is enough. */
export const RETRY_AFTER_SECONDS = 60;
export const SERVICE_UNAVAILABLE = 503;

/** The pages the site shows now, or undefined when the CMS did not answer. */
export async function shownPages(): Promise<SearchPage[] | undefined> {
  try {
    const content = await publishedContent.contentAt(Date.now());
    return searchPagesOf(site.description, site.staticPaths(content));
  } catch (error) {
    console.warn(
      "@seamlet/astro: the pages for search engines could not be listed: the published content did not load",
      error,
    );
    return undefined;
  }
}

/** The answer while the CMS does not answer: crawlers come back later, and keep what they had. */
export function unavailable(): Response {
  return new Response(null, {
    status: SERVICE_UNAVAILABLE,
    headers: { "Retry-After": String(RETRY_AFTER_SECONDS) },
  });
}
