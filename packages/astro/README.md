# @seamlet/astro

Connects an [Astro](https://astro.build) site to the Seamlet CMS ([source](https://github.com/seamlet/sdk)): the owner of the site edits its texts, photos and records right on its pages, and the site keeps its own design, components and code.

## How a site connects

The quick way, in an Astro project:

```bash
npx @seamlet/astro init --title "Кофейня «Зерно»"   # seamlet.json, src/schema.ts, src/seamlet.ts, a first page component
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
     "id": "zerno",
     "title": "Кофейня «Зерно»",
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

   The CMS takes all of it from the site itself, so connecting a site, or changing its schema, needs no change of the CMS. `defineSeamletSite` checks the description exactly as the CMS reads it (`checkSiteDescription`), so a site the CMS would refuse stops its own build and says what to fix: a page address that is not `/` or lower-case segments without a trailing slash (`/menu`, not `/Menu` or `/menu/`), a first page other than `/`, initial content the CMS could not save, `searchTexts` that name no group of a `title` and a `description`, or a schema that cannot work. A schema cannot work with a field name that is empty, holds a dot or is a number (a path of a field reads them as its separator and as a record), an option of the wrong kind (`maxLength: "10"`), a `reference` to a collection it does not have, or an `itemTitle` that names no `text` or `link` field of the record.

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
| `reference({ label, collection })`         | the `id` of a record of a collection of the schema                      | `null`           |
| `references({ label, collection })`        | the `id`s of any number of such records                                 | `[]`             |
| `group({ label, fields })`                 | named fields shown together                                             | each field empty |
| `collection({ label, item, itemTitle? })`  | a list of records of the same fields                                    | `[]`             |

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
- `openingHoursField()` — rows of `days` (`WEEKDAYS`), `opens` and `closes` times and a `note`.

Each takes `{ label }` to name it otherwise.

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

A collection can have a page for each of its records: a product, a dish, an article. The site writes one component, and the owner who adds a record in the CMS gets its page, which the CMS's editor opens and edits like any other page (a CMS that reads descriptions of version 1.1, as cms.seamlet.ru does from its release 1.1.0). `recordPages` names the collection and the address of its pages, `[record]` standing for the record:

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

`RequestForm.astro` renders plain elements with classes (`seamlet-form`, `seamlet-form-field`, `seamlet-form-issue`, `seamlet-form-consent`, `seamlet-form-submit`, `seamlet-form-sent`, `seamlet-form-failed`), which the site styles from around it: `.contacts :global(.seamlet-form-field)`. Its props are the `form`, the words of the button (`submitLabel`), what the visitor reads once the request is sent or could not be (`sentText`, `failedText`), the pages of the visitor's consent and of the business's policy the checkbox links to (`consentHref` and `policyHref`, the site's own `/consent` and `/privacy` by default, `CONSENT_PAGE_PATH` and `PRIVACY_PAGE_PATH`) and `instance`, which tells apart two forms of the same id on one page.

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
    siteUrl: "https://lesnaya.ru",
    pathOf: productPages.pathOf,
  });
  const feed = yandexFeedOf(
    {
      name: "Лесная мастерская",
      company: "ООО «Лесная мастерская»",
      url: "https://lesnaya.ru",
    },
    offers,
    new Date(),
  );
  return new Response(feed, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
```

## What the integration adds

- `/preview` and `/preview/<page>`: the preview the CMS's editor frames, the pages of records too (at their address or at the record's id, a page the site does not show too). `GET` shows the published content; `POST` with the content as JSON shows that content without saving it, which is how the editor shows every edit at once. Only the CMS may frame it (`Content-Security-Policy: frame-ancestors`), and it is never indexed or cached; its refusals (an address of no page, a record a draft does not have, a draft that is not JSON or is over 1 MB) say the same.
- The bridge on the preview: it tells the editor where the marked elements are and what a person does on the page, and types texts in place, formatted ones too.
- `/seamlet/site.json`: what the site tells the CMS about itself (`SITE_DESCRIPTION_PATH`): its id and name from `seamlet.json`, its schema, the content it starts with and its pages. The CMS reads it with `readSiteDescription` whenever the site is opened in its editor.
- `/seamlet-photos/<address>`: the site's own photo at an address its content gives it, found by `photos` of `defineSeamletSite`, for the CMS's editor.
- `/media/<site>/<file>`: the photos uploaded for the site in the CMS, taken from it on request (`502` when the CMS does not answer in 10 seconds or fails); a static build copies every photo uploaded for the site that its built pages refer to next to them, a few at a time, so a static host serves them too. Loading the published content waits 30 seconds for the CMS and stops the build when it does not answer.

A site never renders content as raw HTML (`set:html`): the editor acts on what its preview says.

To connect the site, an administrator of the CMS gives it the preview's address, `https://<site>/preview`; the CMS takes the site's description from its origin.
