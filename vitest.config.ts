import { defineConfig } from "vitest/config";

// Tests run in Node; a test of the DOM asks for jsdom itself (`// @vitest-environment jsdom`).
// A test of an Astro component, route or site module (`*.astro.test.ts`) runs with Astro's compiler,
// in the project of its package or site.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "packages/*/src/**/*.test.ts",
            "examples/*/src/**/*.test.ts",
          ],
          exclude: ["**/*.astro.test.ts", "**/node_modules/**"],
        },
      },
      "packages/astro/vitest.config.ts",
      "examples/*/vitest.config.ts",
    ],
  },
});
