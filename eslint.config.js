import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist", "coverage", "**/.astro", ".cyberzavod", ".claude"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  ...astro.configs.recommended,
  {
    files: ["**/*.astro"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // The schema language runs in the browser (the editor, the bridge) and on servers (saving, the
    // preview): it depends on nothing but itself.
    files: ["packages/astro/src/schema/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "node:*", "astro*", "virtual:*"],
              message: "The schema language depends only on itself",
            },
          ],
        },
      ],
    },
  },
  {
    // The bridge runs on a site's page: it knows only itself and the schema language.
    files: ["packages/astro/src/bridge/**"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!\\./|\\.\\./schema$)",
              message:
                "The bridge depends only on itself and the schema language",
            },
          ],
        },
      ],
    },
  },
  {
    // The feeds are plain text made from content: they know only themselves and the schema language.
    files: ["packages/astro/src/feeds/**"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!\\./|\\.\\./schema$)",
              message:
                "The feeds depend only on themselves and the schema language",
            },
          ],
        },
      ],
    },
  },
  {
    // What a site gives search engines is plain text and data made from content: it knows only
    // itself, the schema language and how the feeds write XML and read a product.
    files: ["packages/astro/src/search/**"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!\\./|\\.\\./schema$|\\.\\./feeds/(xml|offers)$)",
              message:
                "The search layer depends only on itself, the schema language and the feeds' XML and offers",
            },
          ],
        },
      ],
    },
  },
  {
    // An example is a site like any other: it knows the SDK only as an installed package.
    files: ["examples/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/packages/**"],
              message: "A site takes the SDK from its package: @seamlet/astro",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
);
