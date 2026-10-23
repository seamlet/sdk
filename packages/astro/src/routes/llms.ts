import type { APIRoute } from "astro";
import { siteUrl } from "virtual:seamlet/search";
import site from "virtual:seamlet/site";
import { HOME_PAGE_PATH } from "../schema";
import { llmsTxtOf, type LlmsPage, type LlmsSection } from "../search";
import type { SearchPage } from "../search-pages";
import { shownPages, unavailable } from "./search-pages";

// llms.txt: the site for an AI assistant, made from its description and the content it published:
// its name, the description of its home page, then its pages and the pages of its records under the
// names of their collections.

const CACHE_CONTROL = "public, max-age=300";
/** The heading of the site's own pages; the pages of records stand under their collections. */
const OWN_PAGES_TITLE = "Страницы";

export const GET: APIRoute = async ({ url }) => {
  const pages = await shownPages();
  if (pages === undefined) return unavailable();

  // Without `site` the address the site was asked at is the best there is.
  const origin = siteUrl ?? url.origin;
  const home = pages.find(({ path }) => path === HOME_PAGE_PATH);
  const text = llmsTxtOf({
    title: site.description.title,
    summary: home?.description ?? "",
    sections: sectionsOf(pages, origin),
  });
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
};

/** The site's own pages first, then a section of every collection whose records have pages. */
function sectionsOf(
  pages: readonly SearchPage[],
  origin: string,
): LlmsSection[] {
  const ownPages = pages.filter(({ collection }) => collection === undefined);
  const collections = [
    ...new Set(pages.flatMap(({ collection }) => collection ?? [])),
  ];
  const recordSections = collections.map((title) => ({
    title,
    pages: pages
      .filter(({ collection }) => collection === title)
      .map((page) => llmsPageOf(page, origin)),
  }));
  const ownSection = {
    title: OWN_PAGES_TITLE,
    pages: ownPages.map((page) => llmsPageOf(page, origin)),
  };
  return [ownSection, ...recordSections];
}

function llmsPageOf(page: SearchPage, origin: string): LlmsPage {
  return {
    url: new URL(page.path, origin).href,
    name: page.name,
    description: page.description,
  };
}
