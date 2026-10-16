# Seamlet SDK

The rules of this repository for agents and humans.

## About the project

What a site installs to be edited in the Seamlet CMS. The CMS (a separate, closed product) stores content, signs people in and publishes; this repository holds only what runs on a site, and it is public.

- TypeScript, strict (`astro/tsconfigs/strict` plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`). ESLint with `strictTypeChecked` and an exhaustive `switch` over a union; Prettier with `prettier-plugin-astro`; Vitest, with jsdom for the DOM (`// @vitest-environment jsdom`); tsup builds the package. Node 24+, npm workspaces.
- Everything is in English: code, comments, messages, tests, commits, documentation. Texts a site's visitor or the CMS's user reads are in Russian.

## Architecture

- `packages/astro` — `@seamlet/astro`, published to npm.
  - `src/schema` — the schema language, the one description of content: field kinds (`text`, `number`, `date`, `image`, `link`, `group`, `collection`) and their builders, `ContentOf`, `defaultContent`, `parseContent` (brings any input to the shape of a schema, with issues by field path), `editable<Content>()` (the typed marker `data-cms-path` on the element that shows a field or a record) and `resolveFieldPath`, the one rule of where a link may lead (`link-addresses.ts`). Plain data that survives JSON, pure TypeScript: sites render with it, and the CMS checks and stores content with the same code (`@seamlet/astro/schema`).
  - `src/bridge` — the bridge on a site's preview. `connectToEditor({ editorOrigin })` does nothing outside a frame, says `ready` with its `PROTOCOL_VERSION` and, once the editor connects with the schema, reports where the marked elements are, what a person does, types texts in place and renders the editor's drafts. `messages.ts` is the one description of what the bridge and the editor say to each other with `postMessage`; each side reads what it gets into those types and drops the rest, and hears only the other's window and origin. `PROTOCOL_VERSION` is raised whenever a message changes in a way the other side cannot read: sites update the package when they like, so the editor meets bridges of other versions.
  - `src/protocol.ts` — what the CMS's editor needs to speak to the bridge (`@seamlet/astro/protocol`): the messages, their readers and the rules both sides share. `@seamlet/astro/bridge` also gives `connectPage`, for the editor's tests.
  - `src/index.ts` — the integration `seamlet({ cms, site })`: virtual modules for the site's build (`virtual:seamlet/config` with the CMS's origin, `virtual:seamlet/site`, the site's module), the preview (`/preview/[...page]`, `routes/preview.astro`, with `preview-requests.ts`: `GET` with the published content, `POST` with a JSON draft no bigger than 1 MB; `frame-ancestors` of the CMS, `noindex`, `no-store`) and the photos taken from the CMS (`/media/[site]/[file]`), both rendered on request. The bridge goes on every page as a tiny script (`client.ts`) that loads the bridge only on `/preview` in a frame: a script of the injected route would be left out of a static site's on-demand pages.
  - `src/site.ts` — `defineSeamletSite({ id, schema, pages })`, a site's one module, with `pageAt` and `loadPublishedContent`.
  - Its README is what a site's author reads.
- `examples/coffee-shop` — the test site, connected the way every site is: it takes `@seamlet/astro` from the workspace as an installed package, so it checks the package as a site uses it. Its `Dockerfile` builds it for a server.

Boundaries, enforced by ESLint: `src/schema` imports nothing outside itself; `src/bridge` imports only `src/schema`; examples take only `@seamlet/astro`.

A site never renders content as raw HTML (`set:html`): the CMS's editor acts on what the preview says.

## Rules

- Do what the task is about, and no more; name what you noticed along the way in the report.
- New logic comes with a test next to it (`*.test.ts`). A test checks behavior, not the structure of the code.
- No magic values: numbers and strings with a meaning get a name. A comment explains why, not what.
- A change of the schema or of the messages is a change of the public API: it gets a version of the package, and a change of the messages the other side cannot read raises `PROTOCOL_VERSION`.
- Keys, tokens and server addresses never go into the repository.
- Commits follow Conventional Commits.

## Commands

- `make check` — the package's build, formatting check, types (`tsc` for the package, `astro check` for the examples), ESLint, Vitest, the examples' build. It must pass before a commit.
- `npm run dev:coffee-shop` — the test site on http://localhost:4322, its content from `CMS_ORIGIN` (`http://localhost:4321` by default).
- `npm pack --workspace @seamlet/astro` — what would be published. A release: raise `version` in `packages/astro/package.json`, merge, push the tag `astro-v<version>` (`.github/workflows/publish-astro.yml`, `NPM_TOKEN` of the `npm` environment).
