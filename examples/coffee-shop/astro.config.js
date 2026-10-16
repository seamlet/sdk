import process from "node:process";
import node from "@astrojs/node";
import seamlet from "@seamlet/astro";
import { defineConfig } from "astro/config";

// The coffee shop is a site of its own: it shows its published content, and @seamlet/astro adds the
// preview the CMS's editor frames.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 4322 },
  integrations: [
    seamlet({
      // Where the content comes from and whose editor may frame the preview: development runs the
      // CMS on its default port, a deployment sets the CMS's address when it builds the site.
      cms: process.env["CMS_ORIGIN"] ?? "http://localhost:4321",
      site: "./src/seamlet.ts",
    }),
  ],
  vite: {
    // The package is linked from the workspace, outside this folder.
    server: { fs: { allow: ["../.."] } },
    // Keeps every script a file, however small: the site's policy allows scripts only from itself.
    build: { assetsInlineLimit: 0 },
  },
});
