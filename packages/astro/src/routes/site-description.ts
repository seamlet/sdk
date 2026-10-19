import type { APIRoute } from "astro";
import site from "virtual:seamlet/site";

// What the site tells the CMS about itself: its name, the schema of its content, the content it
// starts with and its pages. The CMS takes it from here whenever the site is opened in its editor,
// so a new schema reaches the CMS with the deployment that brings it.

export const GET: APIRoute = () =>
  Response.json(site.description, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
