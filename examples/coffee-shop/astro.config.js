import node from "@astrojs/node";
import seamlet from "@seamlet/astro";
import { defineConfig } from "astro/config";

// The coffee shop is a site of its own: it shows its published content, and @seamlet/astro adds the
// preview the CMS's editor frames.
export default defineConfig({
  // The site's address: the sitemap, robots.txt and llms.txt name its pages by it.
  site: "https://example.ru",
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 4322 },
  // The site's id, title and CMS are in seamlet.json: development runs the CMS on its default port,
  // and a deployment sets the CMS's address in CMS_ORIGIN when it builds the site.
  integrations: [seamlet()],
  vite: {
    // The package is linked from the workspace, outside this folder.
    server: { fs: { allow: ["../.."] } },
    // Keeps every script a file, however small: the site's policy allows scripts only from itself.
    build: { assetsInlineLimit: 0 },
  },
});
