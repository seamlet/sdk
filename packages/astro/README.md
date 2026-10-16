# @seamlet/astro

Connects an [Astro](https://astro.build) site to the Seamlet CMS ([source](https://github.com/seamlet/sdk)): the owner of the site edits its texts, photos and records right on its pages, and the site keeps its own design, components and code.

## How a site connects

1. Install the package. The site needs an adapter, because the preview is rendered on request; its own pages may stay static.

   ```bash
   npm install @seamlet/astro
   ```

2. Describe the content with a schema, and mark the elements that show it:

   ```ts
   // src/schema.ts
   import {
     collection,
     defineSchema,
     number,
     text,
     type ContentOf,
   } from "@seamlet/astro/schema";

   export const schema = defineSchema({
     title: text({ label: "Заголовок", maxLength: 60 }),
     menu: collection({
       label: "Меню",
       itemTitle: "name",
       item: {
         name: text({ label: "Название" }),
         price: number({ label: "Цена, ₽", min: 0 }),
       },
     }),
   });

   export type Content = ContentOf<typeof schema>;
   ```

   ```astro
   ---
   import { editable } from "@seamlet/astro/schema";
   const edit = editable<Content>(); // a path the content does not have does not compile
   ---

   <h1 {...edit("title")}>{content.title}</h1>
   ```

3. Name the site's address in the CMS and its pages: components that take the content as their `content` prop.

   ```ts
   // src/seamlet.ts
   import { defineSeamletSite } from "@seamlet/astro/site";
   import HomePage from "./components/HomePage.astro";
   import { schema } from "./schema";

   export default defineSeamletSite({
     id: "zerno",
     schema,
     pages: { "/": HomePage },
   });
   ```

4. Add the integration:

   ```js
   // astro.config.mjs
   import seamlet from "@seamlet/astro";

   export default defineConfig({
     integrations: [
       seamlet({ cms: "https://cms.example.com", site: "./src/seamlet.ts" }),
     ],
   });
   ```

The site's pages take their published content with `site.loadPublishedContent()`: at build time for a static site, on request otherwise.

## What the integration adds

- `/preview` and `/preview/<page>`: the preview the CMS's editor frames. `GET` shows the published content; `POST` with the content as JSON shows that content without saving it, which is how the editor shows every edit at once. Only the CMS may frame it (`Content-Security-Policy: frame-ancestors`), and it is never indexed or cached.
- The bridge on the preview: it tells the editor where the marked elements are and what a person does on the page, and types texts in place.
- `/media/<site>/<file>`: the photos uploaded in the CMS, taken from it.

A site never renders content as raw HTML (`set:html`): the editor acts on what its preview says.

The preview's address goes on the site's settings page in the CMS: `https://<site>/preview`.
