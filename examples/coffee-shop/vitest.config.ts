/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// A test that takes the site's own module (`*.astro.test.ts`) runs with the site's Astro config,
// so the integration gives it the site's seamlet.json as it gives the build.
export default getViteConfig(
  { test: { name: "coffee-shop", include: ["src/**/*.astro.test.ts"] } },
  { root: import.meta.dirname, logLevel: "error" },
);
