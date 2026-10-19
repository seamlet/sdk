# @seamlet/astro

Connects an [Astro](https://astro.build) site to the Seamlet CMS ([source](https://github.com/seamlet/sdk)): the owner of the site edits its texts, photos and records right on its pages, and the site keeps its own design, components and code.

## How a site connects

The quick way, in an Astro project:

```bash
npx @seamlet/astro init --title "Кофейня «Зерно»"   # seamlet.json, src/schema.ts, src/seamlet.ts, a first page component
npx astro add @seamlet/astro node                   # the integration, and an adapter for the preview
```

`init` takes the id from the name in `package.json` unless `--id` gives it, and the CMS `https://cms.seamlet.ru` unless `--cms` names another; it never overwrites a file the site has, and says what to render in a page. The steps below are what it starts, one by one.

1. Install the package. The site needs an adapter, because the preview is rendered on request; its own pages may stay static.

   ```bash
   npm install @seamlet/astro
   ```

2. Name the site in `seamlet.json` at its root: its id in the CMS (lower-case letters, digits and single hyphens; its address there, `/sites/<id>`, the name of its content and the host of its preview), how the CMS names it, and the CMS it belongs to. The CMS reads the same file from the site's repository, so the id is written once.

   ```json
   {
     "id": "zerno",
     "title": "Кофейня «Зерно»",
     "cms": "https://cms.seamlet.ru"
   }
   ```

   The environment variable `CMS_ORIGIN` takes the place of `cms` when it is set: a build for a CMS in development, or the CMS's own builder. A build without the file, or with a field it cannot read, stops and says which field to fix.

3. Describe the content with a schema, and mark the elements that show it:

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

4. Describe the site for the CMS in `src/seamlet.ts`: its schema, the content it starts with, and its pages, each with the name the editor gives it and the component that renders it (it takes the content as its `content` prop). The home page `/` comes first; `searchTexts` names where the content holds a page's title and description for search engines, a group of a `title` and a `description` text (`seoFields`).

   ```ts
   // src/seamlet.ts
   import { defineSeamletSite } from "@seamlet/astro/site";
   import HomePage from "./components/HomePage.astro";
   import { initialContent } from "./initial-content";
   import { schema } from "./schema";

   export default defineSeamletSite({
     schema,
     initialContent,
     pages: {
       "/": { title: "Главная", component: HomePage, searchTexts: "seo.home" },
     },
   });
   ```

   The CMS takes all of it from the site itself, so connecting a site, or changing its schema, needs no change of the CMS.

5. Add the integration; it reads `seamlet.json` and `src/seamlet.ts` itself:

   ```js
   // astro.config.mjs
   import seamlet from "@seamlet/astro";

   export default defineConfig({
     integrations: [seamlet()],
   });
   ```

The site's pages take their published content with `site.loadPublishedContent()`: at build time for a static site, on request otherwise. A module that needs the content without importing every page takes it with `loadPublishedContent(schema)` of `@seamlet/astro/site`.

## Fields

| Builder                                    | Holds                                                                   | Empty            |
| ------------------------------------------ | ----------------------------------------------------------------------- | ---------------- |
| `text({ label, multiline?, maxLength? })`  | a string                                                                | `""`             |
| `richText({ label, inline?, maxLength? })` | paragraphs and lists of pieces, bold, italic or links (below)           | `[]`             |
| `number({ label, min?, max? })`            | a number                                                                | `null`           |
| `date({ label })`                          | `YYYY-MM-DD`                                                            | `null`           |
| `time({ label })`                          | `HH:MM`, 00:00 to 23:59                                                 | `null`           |
| `image({ label })`                         | `{ src, alt }`                                                          | `null`           |
| `link({ label })`                          | `{ text, href }`: a page of the site, another site, a phone or an email | `null`           |
| `url({ label })`                           | a web address without a text: a booking widget, a map                   | `null`           |
| `toggle({ label })`                        | `true` or `false`                                                       | `false`          |
| `choice({ label, options })`               | the `value` of one option                                               | `null`           |
| `choices({ label, options })`              | the `value`s of any number of options                                   | `[]`             |
| `reference({ label, collection })`         | the `id` of a record of a collection of the schema                      | `null`           |
| `references({ label, collection })`        | the `id`s of any number of such records                                 | `[]`             |
| `group({ label, fields })`                 | named fields shown together                                             | each field empty |
| `collection({ label, item, itemTitle? })`  | a list of records of the same fields                                    | `[]`             |

Options are `{ value, label }`: the site reads `value`, the editor shows `label`, so a label can change without touching the site. The content has their exact type:

```ts
const level = choice({
  label: "Нагрузка",
  options: [
    { value: "soft", label: "Мягко" },
    { value: "active", label: "Активно" },
  ],
});
// ContentOf gives "soft" | "active" | null
```

To let the owner hide a record without removing it, give the record a toggle and leave hidden records out:

```ts
item: { name: text({ label: "Название" }), isHidden: toggle({ label: "Скрыть с сайта" }) }
// content.practices.filter((practice) => !practice.isHidden)
```

A photo may carry the point that must stay in view when the site crops it, chosen in the editor: put `imagePosition(photo)` into its `object-position` (the middle when no point is chosen):

```astro
<img
  src={photo.src}
  alt={photo.alt}
  style={`object-fit: cover; object-position: ${imagePosition(photo)}`}
/>
```

A photo may also be one of the site's own files, named by an address of the site (`/menu/01.jpg`) that the site turns into its image when it renders. Give `defineSeamletSite` a `photos` function that finds that image, and the CMS's editor shows the photo in its field too:

```ts
const MENU_FILES = import.meta.glob<{ default: ImageMetadata }>(
  "./assets/menu/*.jpg",
  { eager: true },
);

export default defineSeamletSite({
  schema,
  initialContent,
  pages: { "/": { title: "Главная", component: HomePage } },
  photos: (src) => MENU_FILES[src.replace("/menu/", "./assets/menu/")]?.default,
});
```

A text with a link in a sentence, bold words or a list is one `richText` field, not a text cut around the link. Its value is data, never HTML: paragraphs (`{ kind: "paragraph", spans }`) and lists (`{ kind: "list", items }`) of pieces `{ text, bold?, italic?, href? }`, where `href` leads where a `link` may. `inline` keeps it one paragraph without lists, for a text inside an element that holds one line. A saved plain string is read as paragraphs, so a `text` field turned into `richText` keeps its words. Render it with the component of the package, which puts out paragraphs and lists (or, with `inline`, the words alone) and never raw HTML; style its elements from around it:

```astro
---
import RichText from "@seamlet/astro/components/RichText.astro";
---

<div class="about" {...edit("about")}>
  <RichText value={content.about} />
</div>
<p {...edit("note")}>
  <RichText value={content.note} inline />
</p>
<style>
  .about :global(a) {
    color: inherit;
  }
</style>
```

When the marked element holds the component alone, the editor types the text right on the page: a person clicks a paragraph and types, marks the selected words bold or italic (⌘B, ⌘I or the toolbar beside the selection) and puts a link on them. The element is then rendered with the same elements the component puts out, so style them from around it, never by classes of your own on them.

`plainTextOf` gives its words without marks, for a page title or a description.

## Presets

Sets of fields almost every site has, edited the same way everywhere; they are plain groups and collections, rendered as the site likes:

- `seoFields()` — `title`, `description` and `image` of a page for search engines and links shared in messengers;
- `contactsFields()` — `phone` (a link), `address`, `map` (an address) and `messengers` (links);
- `openingHoursField()` — rows of `days` (`WEEKDAYS`), `opens` and `closes` times and a `note`.

Each takes `{ label }` to name it otherwise.

## Records and references

Every record of a collection has an `id` of its own, which never changes when records move, so a record has no field named `id`. The CMS gives ids to records that have none (`withRecordIds`), so a site's initial content may leave them out, unless something refers to those records.

A reference points at a record of another collection by its id: the teacher of a practice is chosen from the teachers, so renaming the teacher changes every practice at once. `collection` is where the collection is, its name or a path through groups:

```ts
const schema = defineSchema({
  teachers: collection({
    label: "Преподаватели",
    itemTitle: "name",
    item: { name: text({ label: "Имя" }) },
  }),
  practices: collection({
    label: "Практики",
    itemTitle: "name",
    item: {
      name: text({ label: "Название" }),
      teacher: reference({ label: "Ведёт", collection: "teachers" }),
    },
  }),
});
// findRecord(content.teachers, practice.teacher)?.name
```

A reference to a record removed since is kept, with the issue `missing-record`: the content is not saved until the person picks another one or clears it.

## What the page hides

A field is edited where it is seen, so the editor opens what hides it when a person chooses it in the list of fields. A native `<details>` needs nothing: a click on its summary opens it in the editor too. Neither do tabs, filters and toggles made of radio buttons and checkboxes and shown with CSS: a click on one or its label flips it in the editor, and the page keeps it flipped after every edit. A part the site hides and shows by itself (its own accordion, a step of a quiz, a dialog, a tab) gets the attribute `data-cms-reveal` (`REVEAL_ATTRIBUTE`). When a field inside it is chosen, the bridge sets `data-cms-revealed` on it and sends it the event `cms:reveal`, which bubbles; the site shows the part with CSS or with its own script:

```css
[data-cms-reveal][data-cms-revealed] {
  display: block;
}
```

What was opened stays open while the page is rendered anew after every edit.

## What the integration adds

- `/preview` and `/preview/<page>`: the preview the CMS's editor frames. `GET` shows the published content; `POST` with the content as JSON shows that content without saving it, which is how the editor shows every edit at once. Only the CMS may frame it (`Content-Security-Policy: frame-ancestors`), and it is never indexed or cached.
- The bridge on the preview: it tells the editor where the marked elements are and what a person does on the page, and types texts in place, formatted ones too.
- `/seamlet/site.json`: what the site tells the CMS about itself (`SITE_DESCRIPTION_PATH`): its id and name from `seamlet.json`, its schema, the content it starts with and its pages. The CMS reads it with `readSiteDescription` whenever the site is opened in its editor.
- `/seamlet-photos/<address>`: the site's own photo at an address its content gives it, found by `photos` of `defineSeamletSite`, for the CMS's editor.
- `/media/<site>/<file>`: the photos uploaded in the CMS, taken from it on request; a static build copies every uploaded photo its built pages refer to next to them, so a static host serves them too.

A site never renders content as raw HTML (`set:html`): the editor acts on what its preview says.

To connect the site, an administrator of the CMS gives it the preview's address, `https://<site>/preview`; the CMS takes the site's description from its origin.
