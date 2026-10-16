# Seamlet SDK

What a site installs to be edited in the Seamlet CMS: the owner of a business edits the texts, photos and records of their site right on its pages, while the site keeps its own design, components and code.

- [`@seamlet/astro`](packages/astro/README.md) — for sites on [Astro](https://astro.build): the schema language that describes a site's content, the integration that adds the preview the CMS's editor frames, and the bridge between the two.
- [`@seamlet/design`](packages/design/README.md) — the design tokens and fonts of Seamlet's own landing page and CMS; a site does not need it.
- [`examples/coffee-shop`](examples/coffee-shop) — a test site connected the way every site is.

The CMS itself is a separate product; this repository holds only what runs on a site.

## Development

```bash
npm install
make check              # builds the package, then formatting, types, linter, tests and the test site's build
npm run dev:coffee-shop # the test site on http://localhost:4322, its preview at /preview
```

The test site takes its content from a CMS at `CMS_ORIGIN` (`http://localhost:4321` by default).

## Releases

Raise `version` in `packages/astro/package.json` and merge, then run «Publish @seamlet/astro» from the Actions tab: it checks the repository, publishes the package to npm with provenance and tags the commit `astro-v<version>`. `@seamlet/design` is released the same way: `packages/design/package.json` and «Publish @seamlet/design», tagged `design-v<version>`.

## License

MIT, see [LICENSE](LICENSE).
