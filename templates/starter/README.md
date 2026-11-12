# Seamlet starter

A small Astro site already wired to [Seamlet](https://seamlet.ru): the owner of the business edits its texts, photos and prices right on the page, while the design and the code stay yours. It is a coffee shop's page with a first screen, a menu, contacts and fields for search engines. Change the schema and the page to fit your own site.

Documentation: <https://docs.seamlet.ru/en/astro/connect/>.

## 1. Create the site

```bash
npm create astro@latest -- --template seamlet/sdk/templates/starter
cd <your folder>
npm run dev
```

The site opens at <http://localhost:4321>. Without a published version it shows the content from `src/schema.ts`.

## 2. Name it and put the token in

Open `seamlet.json` and set:

- `id` — the site's name in the CMS: lower-case Latin letters, digits and hyphens. It must be free; a taken one is refused.
- `title` — how the site is called in the CMS.
- `ownerToken` — add this line with your owner token: `"ownerToken": "<your token>"`. The CMS shows the token on the page «Подключить сайт» (Connect a site) at <https://cms.seamlet.ru/sites/connect>. It is not a password and may stay in the repository: it tells the CMS the site is yours.

Do not run `npx @seamlet/astro init` here: it keeps a `seamlet.json` the site already has, and the starter has the schema and the page `init` would write.

## 3. Deploy to Vercel

Put the project in a Git repository on GitHub, then [import it in Vercel](https://vercel.com/docs/getting-started-with-vercel/import) (or run `npx vercel`). The defaults are right: Vercel finds Astro and builds with `npm run build`. The pages are rendered on request, so the site shows what is published in the CMS within a minute, and it needs no build address.

For Netlify, run `npx astro add netlify` (it replaces the adapter in `astro.config.mjs`) and remove `@astrojs/vercel` from `package.json`. The `VERCEL_PROJECT_PRODUCTION_URL` lines of `astro.config.mjs` are only for Vercel: set `site` to the site's address instead.

## 4. Connect it in the CMS

1. Open <https://cms.seamlet.ru/sites/connect>.
2. Give the address of the preview: `https://<your site>/preview`, then press **«Подключить»** (Connect).
3. In the site's **«Настройки»** (Settings), open **«Обновление сайта»** (Updating the site) and choose **«Сайт сам запрашивает контент у CMS»** (The site asks the CMS for its content), so a publication reaches the site with nothing to build.

Sign-up is opening gradually. If the CMS has no sign-up link yet, see [how to get an account](https://docs.seamlet.ru/en/developers/account/).

## 5. Edit

Open the site in the CMS, click a text on the page and type. **«Сохранить»** (Save) keeps the edit, **«Опубликовать»** (Publish) puts it on the site.

## What is in it

- `seamlet.json` — the site's id, title, CMS and owner token.
- `src/schema.ts` — what the owner edits (the schema) and the content the site starts with.
- `src/seamlet.ts` — the site as the CMS knows it: the schema, the starting content and the pages.
- `src/pages/[...page].astro` — the one route that renders every page of `src/seamlet.ts` with the published content.
- `src/components/HomePage.astro` — the page. Every element that shows a field carries `edit(...)`, which is how the editor knows what a click is on; a text that belongs to the code, not to the owner, carries `data-cms-fixed`.
- `astro.config.mjs` — the integration `seamlet()` and the Vercel adapter. The integration adds the preview, the bridge to the editor and `/seamlet/site.json`, where the CMS reads the schema.

## Versions

The starter pins the published `@seamlet/astro` exactly. It is raised after a new version of the package is published, so the starter always builds with what is on npm.
