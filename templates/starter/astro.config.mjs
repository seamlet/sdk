import vercel from "@astrojs/vercel";
import seamlet from "@seamlet/astro";
import { defineConfig } from "astro/config";

// Vercel tells the build the production address; the sitemap and robots.txt name the pages by it.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site =
  productionHost === undefined
    ? "http://localhost:4321"
    : `https://${productionHost}`;

// The pages are rendered on request, so a publication in the CMS is on the site at once. The
// preview the CMS's editor frames is added by the integration; it needs an adapter like this one.
export default defineConfig({
  site,
  output: "server",
  adapter: vercel(),
  // The site's id, title and CMS are in seamlet.json.
  integrations: [seamlet()],
});
