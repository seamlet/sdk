/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// The package's Astro components and routes are rendered with Astro's container in their tests,
// which needs Astro's own compiler of `.astro` files.
export default getViteConfig(
  { test: { name: "astro", include: ["src/**/*.astro.test.ts"] } },
  { root: import.meta.dirname, logLevel: "error" },
);
