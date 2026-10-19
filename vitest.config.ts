import { defineConfig } from "vitest/config";

// Tests run in Node; a test of the DOM asks for jsdom itself (`// @vitest-environment jsdom`).
// A test of an Astro component or route (`*.astro.test.ts`) runs with Astro's compiler.
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
    ],
  },
});
