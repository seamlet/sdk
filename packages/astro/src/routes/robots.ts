import type { APIRoute } from "astro";
import { sitemapUrl } from "virtual:seamlet/search";
import { robotsTxtOf } from "../search";
import { CLOSED_PATHS } from "../search-files";

// robots.txt: every page is open to search engines and AI assistants, the parts that serve the
// CMS are closed, and the sitemap is named when the integration serves one.

const CACHE_CONTROL = "public, max-age=3600";

export const GET: APIRoute = () =>
  new Response(
    robotsTxtOf({
      closedPaths: CLOSED_PATHS,
      ...(sitemapUrl === undefined ? {} : { sitemapUrl }),
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": CACHE_CONTROL,
      },
    },
  );
