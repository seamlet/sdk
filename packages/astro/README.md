# @seamlet/astro

Connects an [Astro](https://astro.build) site to the Seamlet CMS ([source](https://github.com/seamlet/sdk)): the owner of the site edits its texts, photos and records right on its pages, and the site keeps its own design, components and code.

## How a site connects

The quick way, in an Astro project:

```bash
npx @seamlet/astro init --title "Моя кофейня"   # seamlet.json, src/schema.ts, src/seamlet.ts, a first page component
npx astro add @seamlet/astro node                   # the integration, and an adapter for the preview
```

`init` takes the id from the name in `package.json` unless `--id` gives it, and the CMS `https://cms.seamlet.ru` unless `--cms` names another; it never overwrites a file the site has: a `seamlet.json` the site has already names the site for the modules it writes, and the three modules are written together or, when the site has any of them, not at all. It says what to render in a page. The steps below are what it starts, one by one.

1. Install the package. The site needs an adapter, because the preview is rendered on request; its own pages may stay static.

   ```bash
   npm install @seamlet/astro
   ```

2. Name the site in `seamlet.json` at its root: its id in the CMS (lower-case letters, digits and single hyphens; its address there, `/sites/<id>`, the name of its content and the host of its preview), how the CMS names it, and the CMS it belongs to. The CMS reads the same file from the site's repository, so the id is written once.

   ```json
   {
     "id": "cafe",
     "title": "Моя кофейня",
     "cms": "https://cms.seamlet.ru"
   }
   ```

   The environment variable `CMS_ORIGIN` takes the place of `cms` when it is set and not empty: a build for a CMS in development, or the CMS's own builder. A build without the file, or with a field it cannot read, stops and says which field to fix.

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

4. Describe the site for the CMS in `src/seamlet.ts`: its schema, the content it starts with, and its pages, each with the name the editor gives it and the component that renders it (it takes the content as its `content` prop), and the pages of records if it has them (see «Pages of records»). The home page `/` comes first; `searchTexts` names where the content holds a page's title and description for search engines, a group of a `title` and a `description` text (`seoFields`).

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

   The CMS takes all of it from the site itself, so connecting a site, or changing its schema, needs no change of the CMS. `defineSeamletSite` checks the description exactly as the CMS reads it (`checkSiteDescription`), so a site the CMS would refuse stops its own build and says what to fix: a page address that is not `/` or lower-case segments without a trailing slash (`/menu`, not `/Menu` or `/menu/`), a first page other than `/`, initial content the CMS could not save, `searchTexts` that name no group of a `title` and a `description`, or a schema that cannot work. A schema cannot work with a field name that is empty, holds a dot or is a number (a path of a field reads them as its separator and as a record), an option of the wrong kind (`maxLength: "10"`), a `reference` to a collection it does not have, or an `itemTitle` that names no `text`, `link`, `choice` or `choices` field of the record.

5. Add the integration; it reads `seamlet.json` and `src/seamlet.ts` itself:

   ```js
   // astro.config.mjs
   import seamlet from "@seamlet/astro";

   export default defineConfig({
     integrations: [seamlet()],
   });
   ```

A site renders all its pages, the pages of records too (below), from one route `src/pages/[...page].astro`: `site.staticPaths(content)` lists every page for a static build, and `site.pageOf(rest, content)` finds the one asked for on request; each gives the component and the props to render it with.

```astro
---
// src/pages/[...page].astro, built as static pages
import site from "../seamlet";

export async function getStaticPaths() {
  return site.staticPaths(await site.loadPublishedContent());
}

const { component: Page, props } = Astro.props;
---

<Page {...props} />
```

The site's pages take their published content with `site.loadPublishedContent()`: at build time for a static site, on request otherwise. Until the first publication, and while the CMS does not know the site yet (a site connected from its repository is built before that), it is the site's initial content; any other refusal of the CMS stops the build. A module that needs the content without importing every page takes it with `loadPublishedContent(schema)` of `@seamlet/astro/site`.

## Fields

| Builder                                    | Holds                                                                   | Empty            |
| ------------------------------------------ | ----------------------------------------------------------------------- | ---------------- |
| `text({ label, multiline?, maxLength? })`  | a string                                                                | `""`             |
| `richText({ label, inline?, maxLength? })` | paragraphs and lists of pieces, bold, italic or links (below)           | `[]`             |
| `number({ label, min?, max? })`            | a number                                                                | `null`           |
| `date({ label })`                          | `YYYY-MM-DD`                                                            | `null`           |
| `time({ label })`                          | `HH:MM`, 00:00 to 23:59                                                 | `null`           |
| `slug({ label })`                          | the address of a record's page, `latte` in `/menu/latte` (below)        | `""`             |
| `image({ label })`                         | `{ src, alt }`                                                          | `null`           |
| `file({ label })`                          | `{ src, name }`: a PDF uploaded in the CMS, a price list or a menu      | `null`           |
| `link({ label })`                          | `{ text, href }`: a page of the site, another site, a phone or an email | `null`           |
| `url({ label })`                           | a web address without a text: a booking widget, a map                   | `null`           |
| `toggle({ label })`                        | `true` or `false`                                                       | `false`          |
| `choice({ label, options })`               | the `value` of one option                                               | `null`           |
| `choices({ label, options })`              | the `value`s of any number of options                                   | `[]`             |
| `words({ label })`                         | a list of words the owner types, shown as tags: the notes of a taste    | `[]`             |
| `reference({ label, collection })`         | the `id` of a record of a collection of the schema                      | `null`           |
| `references({ label, collection })`        | the `id`s of any number of such records                                 | `[]`             |
| `group({ label, fields })`                 | named fields shown together                                             | each field empty |
| `collection({ label, item, itemTitle? })`  | a list of records of the same fields                                    | `[]`             |

A `words` field is for a short list the site shows apart, as tags or a list: «Бергамот, персик, мёд». The CMS edits it word by word, and a table or a file of Excel writes it as one cell with the words between commas (`wordsTextOf`, read back by `wordsOf`). A `text` field whose words stand between commas may become a `words` field at any time: the CMS reads what the owner saved as the list, and a `words` field that becomes a `text` again keeps the words between commas. A CMS reads a schema with a `words` field from 2.8.0 of the package on.

`itemTitle` names the field whose words name a record in the CMS's list of records, its history and the site's `llms.txt`: a `text`, a `link` by its text, or a `choice` or `choices` by the labels of the options picked. `choiceTitleOf(field, value)` of `@seamlet/astro/schema` is how such a title reads, the same in the CMS and on the site: a `choice` gives its option's label; `choices` gives the labels in the schema's order, joined by commas, and when its options are days of the week in the week's order (`WEEKDAYS`, or some of them), three or more days in a row read as the first and the last: «Пн–Пт, Сб». `recordTitleOf(collection, record)` reads the title of any record that way. A CMS reads a site's description with its own version of the package: a schema that titles records by a choice needs a CMS that reads 2.5.

A file is a document the owner uploads in the CMS as a PDF. The site links to it, and a static build copies it next to its pages as it copies the uploaded photos:

```astro
{content.priceList && (
  <a href={safeHref(content.priceList.src)} download>
    {content.priceList.name}
  </a>
)}
```

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

The preview renders the editor's draft before it is saved, and a draft may hold an address a link may not have (`javascript:…`, or one half typed). Put the address of a `link` or a `url` into `href` through `safeHref`, which gives it back when a link may lead there and nothing otherwise:

```astro
---
import { safeHref } from "@seamlet/astro/schema";
const href =
  content.signup === null ? undefined : safeHref(content.signup.href);
---

{href !== undefined && <a href={href}>{content.signup?.text}</a>}
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

A text with a link in a sentence, bold words or a list is one `richText` field, not a text cut around the link. Its value is data, never HTML: paragraphs (`{ kind: "paragraph", spans }`) and lists (`{ kind: "list", items }`) of pieces `{ text, bold?, italic?, href? }`, where `href` leads where a `link` may. `inline` keeps it one paragraph without lists, for a text inside an element that holds one line. A saved plain string is read as paragraphs, so a `text` field turned into `richText` keeps its words, and a `richText` turned into `text` keeps them too, without their marks. Which texts to make formatted: prose (a lead, a description, a paragraph about the place) is `richText`; headings, names of records, the words of buttons and links, contacts and short labels stay `text`, so the owner meets one rule: a paragraph can be formatted, the rest is typed as it is. Give every mark a style the site's fonts can show: a font without an italic needs another way to show `<em>` (another family's italic, a colour), or the owner presses «К» and sees nothing. Render it with the component of the package, which puts out paragraphs and lists (or, with `inline`, the words alone) and never raw HTML; style its elements from around it:

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

`plainTextOf` gives its words without marks, for a page title or a description; `linesOf` gives its lines (the paragraphs and the items of its lists) in their order.

## Presets

Sets of fields almost every site has, edited the same way everywhere; they are plain groups and collections, rendered as the site likes:

- `seoFields()` — `title`, `description` and `image` of a page for search engines and links shared in messengers;
- `contactsFields()` — `phone` (a link), `address`, `map` (an address) and `messengers` (links);
- `openingHoursField()` — rows of `days` (`WEEKDAYS`), `opens` and `closes` times and a `note`; a row is named by its days, «Пн–Пт».

- `shownUntilField()` — the last day a record or a block is shown, a `date` the owner may leave empty; the site checks it with `isShownOn(shownUntil, calendarDayIn(timeZone, new Date()))`, so an offer that ends on Sunday leaves the site on Monday with nobody pressing anything. `calendarDayIn` names the day where the business is (`"Europe/Moscow"`), not where the server is. A site rendered on request checks it on every visit; a static site only when it is built again.

Each takes `{ label }` to name it otherwise.

```astro
---
import { calendarDayIn, isShownOn } from "@seamlet/astro/schema";

const { offer } = Astro.props;
const today = calendarDayIn("Europe/Moscow", new Date());
const isShown = isShownOn(offer.shownUntil, today);
---

{isShown && <p {...edit("offer", "text")}>{offer.text}</p>}
```

`productFields()` is the fields of a product of a catalog, for the record of a collection: `name`, `slug` (the address of its page), `photos` (records of one `photo`, the first is the main one), `summary` (one line for a card), `description`, `price` with `priceNote` («от», «за м²»), `characteristics` (records of a `name` and a `value`, so the owner adds a property without code: «Площадь» — «36 м²»), `isHidden` and `seo`. A site adds its own fields beside them, a category for one:

```ts
export const schema = defineSchema({
  categories: collection({
    label: "Категории",
    itemTitle: "name",
    item: { name: text({ label: "Название" }) },
  }),
  products: collection({
    label: "Товары",
    itemTitle: "name",
    item: {
      ...productFields(),
      category: reference({ label: "Категория", collection: "categories" }),
    },
  }),
});

export const productPages = recordPages(schema, {
  collection: "products",
  path: "/catalog/[record]",
  searchTexts: "seo",
  shows: (product) => !product.isHidden,
});
```

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

## Pages of records

A collection can have a page for each of its records: a product, a dish, an article. The site writes one component, and the owner who adds a record in the CMS gets its page, which the CMS's editor opens and edits like any other page (a CMS that reads descriptions of version 1.1). `recordPages` names the collection and the address of its pages, `[record]` standing for the record:

```ts
// src/schema.ts
import { recordPages, slug } from "@seamlet/astro/schema";

export const schema = defineSchema({
  menu: collection({
    label: "Меню",
    itemTitle: "name",
    item: {
      name: text({ label: "Название" }),
      price: number({ label: "Цена, ₽", min: 0 }),
      slug: slug({ label: "Адрес страницы" }),
    },
  }),
});

export const drinkPages = recordPages(schema, {
  collection: "menu",
  path: "/menu/[record]",
});
```

```ts
// src/seamlet.ts
export default defineSeamletSite({
  schema,
  initialContent,
  pages: {
    "/": { title: "Главная", component: HomePage },
    "/menu": { title: "Меню", component: MenuPage },
  },
  recordPages: [{ pages: drinkPages, component: DrinkPage }],
});
```

The component takes the content, the record and its place in its collection as `content`, `record` and `index`, so its markers point at the record's fields:

```astro
---
// src/components/DrinkPage.astro
import { editable } from "@seamlet/astro/schema";
import type { Content } from "../schema";

interface Props {
  content: Content;
  record: Content["menu"][number];
  index: number;
}

const { record, index } = Astro.props;
const edit = editable<Content>();
---

<h1 {...edit("menu", index, "name")}>{record.name}</h1>
```

`shows` leaves the pages of some records off the site, a hidden product's for one: `site.pageOf` and `site.staticPaths` leave them out and `pathOf` gives them no address, while the preview shows them, so the owner prepares a product before showing it.

`drinkPages.pathOf(drink)` gives the address of a record's page for a link to it: `/menu/latte`. The address is the record's `slug` when it has one, a field the owner fills in (lower-case Latin letters, digits and hyphens; the CMS spells it from the record's name), and its id otherwise, so a record has its page from the moment it is added, and keeps it when it is renamed or moved. A slug another record of the collection has, as its slug or as its id, is the issue `taken-slug`; a slug with other characters, `invalid-slug`. A collection is `catalog.products` through groups, its pages have one segment more than a page of the site (`/catalog/[record]`, never `/[record]`), a record has one page, and no page of the site may stand among the pages of records (`/menu/specials` beside `/menu/[record]`). `searchTexts` names a group of the record with a `title` and a `description` text for its page.

Every record of the initial content needs an address of its own, a slug or an id, since its page is built before the CMS saves anything. The preview shows a page of a record the owner has just added, so the editor opens it before it is saved or published: under the pages of records, an address that could be an id and names no record shows a blank record, which the editor's draft replaces at once.

## What the page hides

A field is edited where it is seen, so the editor opens what hides it when a person chooses it in the list of fields. A native `<details>` needs nothing: a click on its summary opens it in the editor too. Neither do tabs, filters and toggles made of radio buttons and checkboxes and shown with CSS: a click on one or its label flips it in the editor, and the page keeps it flipped after every edit. A part the site hides and shows by itself (its own accordion, a step of a quiz, a dialog, a tab) gets the attribute `data-cms-reveal` (`REVEAL_ATTRIBUTE`). When a field inside it is chosen, the bridge sets `data-cms-revealed` on it and sends it the event `cms:reveal`, which bubbles; the site shows the part with CSS or with its own script:

```css
[data-cms-reveal][data-cms-revealed] {
  display: block;
}
```

What was opened stays open while the page is rendered anew after every edit: a part is known again by its `id`, or else by the field marked on it, in it or around it.

### Moving parts

A text that moves (a marquee, a flipping board, a turning stamp) cannot be typed where it stands, and a moving thing is hard to click. Give such a part, or the marked element itself, the attribute `data-cms-popover` (`POPOVER_ATTRIBUTE`): its fields are edited in the editor's popover, never typed on the page, and in the editor the part holds still while the pointer is over it and once one of its fields is chosen. The bridge pauses the part's CSS animations and transitions itself and sets `data-cms-held` (`HELD_ATTRIBUTE`) on it; motion the site runs with a script stops while that attribute is there. Outside the editor nothing changes.

```astro
---
import { POPOVER_ATTRIBUTE } from "@seamlet/astro/schema";
---

<div class="marquee" {...{ [POPOVER_ATTRIBUTE]: "" }}>
  <p {...edit("specials", "line")}>{content.specials.line}</p>
</div>
```

## Texts the editor reaches

The owner edits what is marked: a click on a text with no field's marker does nothing in the editor, and a field that another element covers cannot be chosen on the page. Two checks name both, so a site does not ship them unnoticed.

Every text a visitor reads is either a field, marked with `edit(...)`, or the code's own: the words of controls («К содержанию», «Назад»), a fixed legal text, what the code builds from the content (an open status, a sum, the year of the copyright line). Mark the code's own texts with `data-cms-fixed` (`FIXED_TEXT_ATTRIBUTE`) on their element or on a part around them:

```astro
<nav class="site-nav" data-cms-fixed>
  <a href="/menu">Меню</a>
  <a href="/contacts">Контакты</a>
</nav>
<p data-cms-fixed>
  © {year} {content.brand.name}
</p>
```

A text inside a marked element counts as reached, and so do texts hidden (`hidden`, `aria-hidden="true"`), what runs and styles (`<script>`, `<style>`, `<template>`), the options of a list and a lone sign such as `·` or `→`.

After a build the integration renders every page of the site's description in its preview with the initial content, the way the editor first shows it, the page of every record too, and lists the texts with no field and no `data-cms-fixed`, the texts every page shows (a header, a footer) once and each kind of page with its own:

```
[@seamlet/astro] 3 texts of the pages have no field, so the CMS's editor cannot edit them. Mark each with editable() of its field, or with data-cms-fixed when the code owns it:
  every page:
    «Каталог» in header > nav > a
  /catalog/[record]:
    «Похожие товары» in section.related > h2
```

`seamlet({ checks: "strict" })` lists them as an error and stops the build when there is such a text, `"off"` turns the check off; `"warn"`, the default, lists them. When the editor reaches every text, the build says so in one line: `[@seamlet/astro] Every text of 8 pages is reachable in the editor or marked as the code's`. The check renders the pages with the built server of `@astrojs/node` on this computer, asking nothing of the CMS; with another adapter it is skipped.

In the editor, the preview writes the same list for the page it shows to the console of its frame once, and, as fields come into view, the fields a click cannot reach: another element lies over every point tried, so a click chooses it instead. The usual one is a card whose link is stretched over the whole card (`a::after { position: absolute; inset: 0 }`): every click on the card's photo, price or description lands on the link. Lift the card's other fields above it, so a visitor still opens the card from anywhere else:

```css
.card {
  position: relative;
}
.card-name a::after {
  content: "";
  position: absolute;
  inset: 0;
}
.card [data-cms-path] {
  position: relative;
  z-index: 1;
}
```

## Typing on the page

In the editor, a click on the page chooses the smallest marked element whose box holds the point, not the element on top: a price or a photo under a card's name stretched as a link over the card is chosen where it is. The choice stays in the block around the element the click landed on, so a sticky header keeps its clicks. A field the page shows as it is, is typed right there:

- a `text` and the words of a `link`, when the marked element shows them alone;
- a `richText` rendered with `RichText` alone in its element;
- a `number` its element shows alone: `240`, or with spaces between thousands and a decimal comma, `1 990` and `2,5`. A unit or a word around it stays outside the marked element, and the page then types only the digits, which take nothing but digits, spaces and a comma:

  ```astro
  {content.menu.map((drink, index) => (
    <p class="price">
      от{" "}
      <span {...edit("menu", index, "price")}>
        {drink.price?.toLocaleString("ru-RU")}
      </span>{" "}
      ₽
    </p>
  ))}
  ```

- a `time` its element shows as it is, `19:00`.

A field the page shows otherwise (a date written in words, a price inside a phrase, a photo, a switch) is edited beside the page, and the editor quotes what the page shows. A tap on a phone gives the keyboard to the field it chooses at once. Escape ends a typing and keeps what was typed, and Tab and Shift+Tab move to the next and the previous field. A text with no field, `data-cms-fixed` or not, is outlined when the pointer is over it, so the owner sees that a developer changes it.

These need a bridge of protocol version 3 (`@seamlet/astro` 2.6.0 or later) and a CMS that speaks it; with an older bridge the editor types texts, and a number its element shows as the bare digits, and edits the rest beside the page.

## Requests

A visitor sends the business a request from the site: «Обратный звонок», «Рассчитать стоимость», «Бронь столика». The site declares its forms, gives them to `defineSeamletSite` and renders them; the CMS passes every request on by mail to the people who edit the site and keeps nothing once it is delivered.

```ts
// src/forms.ts
import {
  requestChoice,
  requestForm,
  requestLongText,
  requestPhone,
  requestText,
} from "@seamlet/astro/schema";

export const estimateForm = requestForm({
  id: "estimate",
  title: "Рассчитать стоимость",
  fields: {
    name: requestText({ label: "Имя", required: true }),
    phone: requestPhone({ label: "Телефон", required: true }),
    size: requestChoice({ label: "Размер", options: ["6×4", "6×6"] }),
    comment: requestLongText({ label: "Комментарий", maxLength: 1000 }),
  },
});
```

```ts
// src/seamlet.ts
export default defineSeamletSite({
  schema,
  initialContent,
  pages,
  forms: [estimateForm],
});
```

```astro
---
import RequestForm from "@seamlet/astro/components/RequestForm.astro";
import { estimateForm } from "../forms";
---

<RequestForm form={estimateForm} submitLabel="Рассчитать" />
```

The fields are `requestText` (a line), `requestLongText` (several lines), `requestPhone`, `requestEmail` and `requestChoice` (one of `options`); each may be `required`, and a text has a `maxLength` (200 for a line, 2000 for several by default). A field's name is a name such as `phone` or `preferredTime`. The form's `title` names its requests in the CMS and in the letters.

`RequestForm.astro` renders plain elements with classes (`seamlet-form`, `seamlet-form-field`, `seamlet-form-issue`, `seamlet-form-consent`, `seamlet-form-submit`, `seamlet-form-sent`, `seamlet-form-failed`), which the site styles from around it: `.contacts :global(.seamlet-form-field)`. Its props are the `form`, the words of the button (`submitLabel`) and the marker of the field they come from (`submitMarker`), what the visitor reads once the request is sent or could not be (`sentText`, `failedText`), the pages of the visitor's consent and of the business's policy the checkbox links to (`consentHref` and `policyHref`, the site's own `/consent` and `/privacy` by default, `CONSENT_PAGE_PATH` and `PRIVACY_PAGE_PATH`) and `instance`, which tells apart two forms of the same id on one page.

The labels of the fields are the form's, the words the CMS names a request's values by in its letters, and the consent says what the law asks, so the form gives both to the code (`data-cms-fixed`): a label changes in `src/forms.ts`. The words of the button are the site's to give; to let the owner edit them, keep them in the content and pass the marker of their field:

```astro
<RequestForm
  form={estimateForm}
  submitLabel={content.order.submit}
  submitMarker={edit("order", "submit")}
/>
```

Without `submitMarker` the button's words are the code's too.

The visitor consents with a checkbox of its own, never checked beforehand, linking to two pages of the site: the consent, a document of its own as 152-ФЗ asks (`/consent` unless `consentHref` names another), and the business's policy (`/privacy` unless `policyHref` names another). The business is the operator of its visitors' data and publishes both; Seamlet only passes a request on by its commission. `privacyConsentFields()` and `privacyPolicyFields()` are the two as content the owner edits, and `privacyConsentTextOf(source)` and `privacyPolicyTextOf(source)` (`source` is `{ siteTitle, operator, forms }`) start them with the business's details and what its forms ask, the policy in the sections Роскомнадзор recommends: put them in the initial content and render each with `RichText` at its page. While the CMS has nobody to mail a site's requests to, it takes none, and the form says it could not send. Without a script the form is posted to the CMS, which answers with a page of its own; with the package's script (on every page, loaded only where a form is) the visitor stays on the page. The script checks what was typed with the code the CMS checks it with (`readRequestValues`), says what to fix under each field and sends the request.

The site's own code hears every step from events on the form element, which bubble:

- `seamlet:request-send` (`REQUEST_SEND_EVENT`), before the request is sent, with `{ form, entries }`. Cancelable: after `event.preventDefault()` the package sends nothing, and the site sends the request its own way.
- `seamlet:request-sent` (`REQUEST_SENT_EVENT`), once the CMS has kept it, with `{ form, entries, id }`: a goal of the site's analytics, its own message.
- `seamlet:request-failed` (`REQUEST_FAILED_EVENT`), with `{ form, reason, issues }`; `reason` is `invalid`, `closed` (the CMS has nobody to mail the site's requests to), `too-many` or `unavailable`.

```ts
document.addEventListener(REQUEST_SENT_EVENT, (event) => {
  ym(COUNTER, "reachGoal", event.detail.form);
});
```

A site whose `Content-Security-Policy` sets `connect-src` or `form-action` lets the CMS's origin in both. A request the policy stops on its way is posted by the browser as a plain form.

## A calculator

`ratesField()` is a collection of rates the owner keeps (what is counted, its unit, its price), and `estimateOf(rates, amounts)` sums what a visitor chose, the amounts known by the ids of their rates, in whole rubles. The site's own script asks the amounts and shows the sum; the page writes the rates for it, `data-rates={JSON.stringify(content.rates)}`. A new price reaches the calculator with the next publication.

## Feeds of the catalog

`@seamlet/astro/feeds` writes the catalog for the places that sell it, from the published content: `yandexFeedOf(shop, offers, madeAt)` in YML (Яндекс Директ, Бизнес, Маркет) and `avitoFeedOf(seller, offers, fieldsOf?)` as an Avito autoload file, `fieldsOf` giving the fields Avito's category asks. `productOffersOf(products, { siteUrl, pathOf })` makes the offers of `productFields` records, leaving the hidden ones out; a product without a price is left out of both feeds.

```ts
// src/pages/feeds/yandex.xml.ts
import { productOffersOf, yandexFeedOf } from "@seamlet/astro/feeds";
import site from "../../seamlet";
import { productPages } from "../../schema";

export async function GET() {
  const content = await site.loadPublishedContent();
  const offers = productOffersOf(content.products, {
    siteUrl: "https://example.ru",
    pathOf: productPages.pathOf,
  });
  const feed = yandexFeedOf(
    {
      name: "Ромашка",
      company: "ООО «Ромашка»",
      url: "https://example.ru",
    },
    offers,
    new Date(),
  );
  return new Response(feed, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
```

## Search engines and AI assistants

A site connected this way is ready to be found by search engines (Яндекс, Google, Bing) and AI assistants (Алиса, ChatGPT, Claude, Perplexity) without code of its own: the integration serves three files from the content published at that moment, and the site's pages tell what they are about with structured data.

Give the integration the site's address, `site` of the Astro config: the sitemap and robots.txt name the pages by it.

```js
// astro.config.mjs
export default defineConfig({
  site: "https://example.ru",
  integrations: [seamlet()],
});
```

- `/sitemap.xml` lists the whole address of every page the site shows: its own pages and the pages of the records `shows` keeps on the site, never the preview or a hidden record. Without `site` it is not served, and the build says so.
- `/robots.txt` lets every crawler read the site and names the crawlers of search engines and AI assistants (`SEARCH_CRAWLERS`: `YandexBot`, `Googlebot`, `GPTBot`, `ClaudeBot`, `PerplexityBot` and the others), closes what serves the CMS (`/preview`, `/seamlet`, `/seamlet-photos`) and names the sitemap.
- `/llms.txt` ([llmstxt.org](https://llmstxt.org)) is the site for an AI assistant: its name from `seamlet.json`, the description of its home page, then its pages and the pages of its records, each a link with its title and description for search engines.

They are rendered on request and keep the published content for half a minute, so a new record's page reaches them with its publication. While the CMS does not answer they answer `503` with `Retry-After`, and crawlers come back. The titles and descriptions are the owner's: the group `searchTexts` names for a page or a record (`seoFields()`), and a page's name in the editor while the owner leaves its title empty.

A site that serves one of the files itself keeps its own: `public/robots.txt`, or a route `src/pages/robots.txt.ts`, wins. To turn one off, pass `false`:

```js
integrations: [seamlet({ sitemap: false, robots: false, llms: false })],
```

### Structured data

`@seamlet/astro/search` builds schema.org things from the content the presets hold, leaving out what the owner left empty, and `StructuredData.astro` renders them as one `<script type="application/ld+json">`, with `<` written as `\u003c`, so no word of the content can close it. Browsers never run a data block, so a policy of scripts from the site alone (`script-src 'self'`) lets it be.

- `localBusinessOf({ type, name, url, ... })` — the business, for every page: `type` is `LocalBusiness` or a more exact type of schema.org (`CafeOrCoffeeShop`, `Restaurant`, `Florist`, `HomeAndConstructionBusiness`), with its `telephone`, `email`, `address` (a line, or `{ streetAddress, addressLocality, ... }`), `openingHours` (the rows of `openingHoursField()`), `images`, `logo`, `sameAs`, `hasMap`, `priceRange`, `areaServed` and `geo`. `businessContactsOf(content.contacts)` reads the phone, the address, the map and the links of `contactsFields()`.
- `productOf(product, { url, availability, prices, category, brand })` — a product of `productFields()` for its page: its name, description, photos and its price in rubles; several `prices` (sizes) are a range, and a product without a price has no offer.
- `breadcrumbsOf([{ name, url }, ...])` — the way from the home page to a page.
- `faqPageOf(questions)` — the questions of a page with their answers, plain or formatted; undefined when none has an answer.

```astro
---
// src/components/Layout.astro
import StructuredData from "@seamlet/astro/components/StructuredData.astro";
import {
  businessContactsOf,
  faqPageOf,
  localBusinessOf,
} from "@seamlet/astro/search";

const { content } = Astro.props;
const business = localBusinessOf({
  type: "CafeOrCoffeeShop",
  name: content.name,
  url: Astro.site?.href ?? Astro.url.origin,
  openingHours: content.openingHours,
  ...businessContactsOf(content.contacts),
});
const faq = faqPageOf(content.faq);
---

<head>
  <StructuredData value={[business, faq]} />
</head>
```

On a product's page, beside the business:

```astro
---
import { breadcrumbsOf, productOf } from "@seamlet/astro/search";

const url = new URL(productPages.pathOf(record) ?? "/", Astro.site).href;
const product = productOf(record, { url });
const breadcrumbs = breadcrumbsOf([
  { name: "Главная", url: new URL("/", Astro.site).href },
  { name: "Каталог", url: new URL("/catalog", Astro.site).href },
  { name: record.name, url },
]);
---

<StructuredData value={[business, product, breadcrumbs]} />
```

What a page shows and what its structured data says must be the same: a price, hours or a question only in the data and not on the page is what search engines punish.

## The credit in the footer

Every site made with Seamlet names it once, at the very bottom of its footer, beside the legal links: a small link «Сделано на Seamlet» to `https://seamlet.ru/`, there for whoever looks for it and quiet for everyone else.

- It is the code's own text, so it carries `data-cms-fixed`, and the owner does not edit it.
- It takes the footer's muted text colour and is a size smaller than the footer's text (`0.8125rem`), with no underline; it brightens to the footer's main text colour and is underlined only on hover and focus.
- It matches the site's own footer: its font, its spacing and the colours of its surface, still readable at 4.5:1 and with a touch target of at least 44 px.
- A site that already names Seamlet in a fixed text of its footer («Демо-сайт, сделанный на Seamlet») needs no second one.

```astro
<p class="footer-legal" data-cms-fixed>
  <a href="/privacy">Политика конфиденциальности</a>
  <a class="footer-made" href="https://seamlet.ru/">
    Сделано на Seamlet
  </a>
</p>

<style>
  .footer-legal {
    display: flex;
    flex-wrap: wrap;
    gap: 0 1.5rem;
  }

  .footer-legal a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }

  .footer-made {
    color: var(--footer-muted);
    font-size: 0.8125rem;
    text-decoration: none;
  }

  .footer-made:hover,
  .footer-made:focus-visible {
    color: var(--footer-text);
    text-decoration: underline;
  }
</style>
```

## What the integration adds

- `/preview` and `/preview/<page>`: the preview the CMS's editor frames, the pages of records too (at their address or at the record's id, a page the site does not show too). `GET` shows the published content; `POST` with the content as JSON shows that content without saving it, which is how the editor shows every edit at once. Only the CMS may frame it (`Content-Security-Policy: frame-ancestors`), and it is never indexed or cached; its refusals (an address of no page, a record a draft does not have, a draft that is not JSON or is over 1 MB) say the same.
- The bridge on the preview: it tells the editor where the marked elements are and what a person does on the page, and types in place texts, formatted ones, the words of links, numbers and times (below).
- `/seamlet/site.json`: what the site tells the CMS about itself (`SITE_DESCRIPTION_PATH`): its id and name from `seamlet.json`, its schema, the content it starts with and its pages. The CMS reads it with `readSiteDescription` whenever the site is opened in its editor.
- After a build, the check of the texts of its pages the editor cannot reach (`checks`, above); in the preview, the same list and the fields another element covers, in the console of the editor's frame.
- `/sitemap.xml`, `/robots.txt` and `/llms.txt` for search engines and AI assistants (above), unless the site serves its own or turns them off.
- `/seamlet-photos/<address>`: the site's own photo at an address its content gives it, found by `photos` of `defineSeamletSite`, for the CMS's editor.
- `/media/<site>/<file>`: the photos uploaded for the site in the CMS, taken from it on request (`502` when the CMS does not answer in 10 seconds or fails); a static build copies every photo uploaded for the site that its built pages refer to next to them, a few at a time, so a static host serves them too. Loading the published content waits 30 seconds for the CMS and stops the build when it does not answer.

A site never renders content as raw HTML (`set:html`): the editor acts on what its preview says.

To connect the site, an administrator of the CMS gives it the preview's address, `https://<site>/preview`; the CMS takes the site's description from its origin.
