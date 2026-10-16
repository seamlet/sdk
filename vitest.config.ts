import { defineConfig } from "vitest/config";

// Tests run in Node; a test of the DOM asks for jsdom itself (`// @vitest-environment jsdom`).
export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/scripts/**/*.test.ts",
      "examples/*/src/**/*.test.ts",
    ],
  },
});
