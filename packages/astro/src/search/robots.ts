// What robots.txt tells crawlers: every page of the site is open to search engines and to the AI
// assistants that answer with it, except the parts that serve the CMS. A crawler named in a group
// follows that group alone, so every crawler is named in the one group of `*`: none of them may
// read the closed parts, whichever group it picks.

/**
 * The crawlers of search engines and AI assistants the file names: Яндекс and Google, Bing,
 * ChatGPT, Claude, Perplexity and Apple, and the tokens that let Яндекс and Google answer with the
 * site in their assistants (`YandexAdditional`, `Google-Extended`).
 */
export const SEARCH_CRAWLERS = [
  "YandexBot",
  "YandexAdditional",
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
] as const;

const EVERY_CRAWLER = "*";
const ROOT_PATH = "/";

export interface RobotsSource {
  /**
   * The parts of the site no crawler reads, each a folder such as `/preview`: the folder itself and
   * everything under it are closed.
   */
  readonly closedPaths: readonly string[];
  /** The whole address of the sitemap, when the site has one. */
  readonly sitemapUrl?: string;
}

export function robotsTxtOf(source: RobotsSource): string {
  const agents = [EVERY_CRAWLER, ...SEARCH_CRAWLERS].map(
    (agent) => `User-agent: ${agent}`,
  );
  // `$` ends the address for Яндекс, Google and Bing, so `/preview$` closes the folder itself
  // and leaves a page such as `/previews` open.
  const closed = source.closedPaths.flatMap((path) => [
    `Disallow: ${path}$`,
    `Disallow: ${path}/`,
  ]);
  const sitemap =
    source.sitemapUrl === undefined
      ? []
      : ["", `Sitemap: ${source.sitemapUrl}`];
  return [...agents, `Allow: ${ROOT_PATH}`, ...closed, ...sitemap, ""].join(
    "\n",
  );
}
