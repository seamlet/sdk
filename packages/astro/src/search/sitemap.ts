import { escapeXml, XML_DECLARATION } from "../feeds/xml";

// The sitemap search engines read (sitemaps.org): the whole address of every page a visitor may
// open, so a page of a record the owner added yesterday is found without a link to it.

const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";

/** The sitemap of the pages at these whole addresses, each listed once in the order given. */
export function sitemapOf(urls: readonly string[]): string {
  const listed = [...new Set(urls)];
  const entries = listed.map(
    (url) => `  <url><loc>${escapeXml(url)}</loc></url>`,
  );
  return [
    XML_DECLARATION,
    `<urlset xmlns="${SITEMAP_NAMESPACE}">`,
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}
