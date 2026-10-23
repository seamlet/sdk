# Changelog

## 2.5.0

- A record of a collection may be titled by a `choice` or `choices` field: `itemTitle` names a `text`, a `link`, a `choice` or a `choices` field. `choiceTitleOf(field, value)` of `@seamlet/astro/schema` is the one rule of how it reads: a `choice` gives its option's label, `choices` the labels in the schema's order joined by commas, three or more days of the week in a row as the first and the last when its options are days of the week («Пн–Пт, Сб»); a value the options no longer list reads as itself. `recordTitleOf(collection, record)` reads the title of any record by that rule; the pages of records in `llms.txt` take it.
- `openingHoursField()` titles its rows by their `days` («Пн–Пт») instead of their `note`.
- The check of the texts of the pages says in one line when the editor reaches every text («Every text of 8 pages is reachable in the editor or marked as the code's»). With `checks: "strict"`, the list of texts is logged as an error and the build stops with a short message of its own, without Astro's unrelated hint about browser APIs and `client:only`.

A CMS reads a site's description with its own version of the package: a site whose schema titles records by a choice, `openingHoursField()` among them, needs a CMS that reads 2.5.0 descriptions; an older one refuses the schema (`invalid-item-title`).

## 2.4.0

- The build lists the texts of the site's pages the CMS's editor cannot reach: after `astro build` the integration renders every page of the site's description in its preview with the initial content (the page of every record too) with the built server of `@astrojs/node`, and warns about every visible text that stands in no element marked with a field and in none marked `data-cms-fixed`, the texts of every page once. `seamlet({ checks: "strict" })` stops the build on one, `"off"` turns the check off, `"warn"` is the default.
- `data-cms-fixed` (`FIXED_TEXT_ATTRIBUTE` of `@seamlet/astro/schema`) marks the texts the code owns: the words of controls, a fixed legal text, what the code builds.
- In the editor, the preview writes to the console of its frame the texts of the page with no field, once, and, as they come into view, the fields another element covers at every point a click could take (a link stretched over a card), with what lies over them. The protocol is the same, so every editor reads it.
- `RequestForm.astro` gives the labels of its fields and the consent to the code (`data-cms-fixed`), and its button too unless `submitMarker` names the field its words come from: `submitMarker={edit("order", "submit")}`.

A site with a build warning marks each text listed: with `edit(...)` of a field the owner edits, or with `data-cms-fixed`.

## 2.3.0

- A site is ready to be found by search engines and AI assistants out of the box. The integration serves `/sitemap.xml` (the site's own pages and the pages of the records `shows` keeps on the site, by `site` of the Astro config), `/robots.txt` (open to every crawler, naming those of search engines and AI assistants, `SEARCH_CRAWLERS`, closing `/preview`, `/seamlet` and `/seamlet-photos`, naming the sitemap) and `/llms.txt` (the site's name, the description of its home page and its pages with their titles and descriptions for search engines). They are rendered on request from the published content, kept for half a minute, and answer `503` while the CMS does not.
- A site that serves one of them itself (`public/` or `src/pages/`) keeps its own; `seamlet({ sitemap, robots, llms })` turns each off. Without `site` the sitemap is not served and the build warns.
- Structured data: `@seamlet/astro/search` with `localBusinessOf` (the business with its contacts and hours, `businessContactsOf` for `contactsFields()`, `openingHoursSpecificationOf` for `openingHoursField()`), `productOf` (a `productFields()` product with its price in rubles), `breadcrumbsOf` and `faqPageOf`, and `components/StructuredData.astro`, which renders them as JSON-LD no word of the content can break. `sitemapOf`, `robotsTxtOf` and `llmsTxtOf` are what the integration writes the files with.

A site sets `site` in its Astro config to get the sitemap. A site whose policy allows scripts from itself only needs no change for the structured data: a data block is never run.

## 2.2.2

- The examples of the README, the comments and the tests name no real site: `my-site`, «Моя кофейня», `example.ru`. A CMS a feature needs is named by the version of the description it reads. Nothing behaves differently.

## 2.2.1

- The Russian texts a visitor and the owner read are edited to the copy rules of `.claude/skills/russian-copy`; nothing behaves differently. `RequestForm.astro` says «Заявка отправлена. Ответим по контактам, которые вы оставили.» once a request is sent and «Заявка не ушла. Всё, что вы ввели, осталось в форме — отправьте ещё раз через минуту.» when it is not; the hidden trap field reads «Оставьте это поле пустым». `REQUEST_ISSUE_TEXTS`: «Слишком длинный текст — сократите его», «Проверьте почту: нужен адрес вида name@mail.ru», «Выберите вариант из списка». The labels of the presets: `note` of `openingHoursField()` is «Примечание», `summary` of `productFields()` «Строка для карточки», `image` of `seoFields()` «Картинка для ссылки в соцсетях». `privacyPolicyTextOf` fixes two sentences of section 5 that did not agree in grammar; its legal meaning is the same.

## 2.2.0

- Moving parts: `data-cms-popover` (`POPOVER_ATTRIBUTE`) on a part of the page that moves, or on a marked element, has its fields edited in the editor's popover instead of typed in place, and in the editor the part holds still while the pointer is over it and once one of its fields is chosen: the bridge pauses its CSS animations and transitions and sets `data-cms-held` (`HELD_ATTRIBUTE`), by which a site stops motion it runs with a script. The protocol is the same, so every editor reads it.

## 2.1.0

- The visitor's consent is a document of its own, as 152-ФЗ asks since 1 September 2025: `privacyConsentFields()` and `privacyConsentTextOf(source)` make it, at `/consent` of the site (`CONSENT_PAGE_PATH`), and the checkbox of `RequestForm.astro` links to it and to the policy («Даю согласие на обработку персональных данных и принимаю политику их обработки»; `consentHref` names another page).
- `privacyPolicyTextOf` follows the sections Роскомнадзор recommends a policy to have: general provisions, purposes with the data, subjects, ways, terms and erasure of each, legal grounds, the data and whose it is, how it is processed and protected (the commission to Seamlet, storage in Russia, notice of leaks), and how it is corrected, erased and asked about, with the terms of the law.

A site with a form adds the page `/consent` (or passes `consentHref`).

## 2.0.0

- The consent of a form links to the business's own policy, a page of the site (`policyHref`, `/privacy` by default, `PRIVACY_PAGE_PATH`), not to texts kept by the CMS: the business is the operator of its visitors' data, and the CMS only passes requests on. `privacyPolicyFields()` is the policy as content and `privacyPolicyTextOf({ siteTitle, operator, forms })` a template to start it with.
- Breaking: `RequestForm.astro` has no `consentHref` and no separate paragraph of the policy (`seamlet-form-policy`); `legalPagePathOf` and `LegalDocument` are gone. The reason `closed` of `seamlet:request-failed` now means the CMS has nobody to mail the site's requests to.

## 1.5.0

- Feeds of the catalog: `@seamlet/astro/feeds` with `yandexFeedOf` (YML for Яндекс), `avitoFeedOf` (an Avito autoload file, with the fields of its category from the site) and `productOffersOf`, the offers of `productFields` records.
- A calculator whose prices the owner keeps: `ratesField()` and `estimateOf(rates, amounts)`.

## 1.4.0

- Documents: `file({ label })` holds a PDF the owner uploads in the CMS, `{ src, name }` (`FileValue`): a price list, a menu, a contract. An empty name of a file asks for its file (`missing-file-src`). A static build copies the uploaded documents its pages link to, as it copies the photos, and the route of uploads serves them on request; `isUploadedFile` names both.

A site with a file field needs a CMS that reads 1.4. Code with an exhaustive `switch` over `FieldKind` or over the issues of `parseContent` gets the new member to handle.

## 1.3.0

- Requests: `requestForm({ id, title, fields })` with `requestText`, `requestLongText`, `requestPhone`, `requestEmail` and `requestChoice` declares a form visitors send the business requests with; `defineSeamletSite` takes them as `forms`, and the site's description tells the CMS about them. `RequestForm.astro` renders one, with a checkbox of consent of its own; it is posted to the CMS without a script, and sent in place with it.
- `readRequestEntries(body)` reads a request's body into its words, and `readRequestValues(form, entries)` checks a request the same way in the browser and in the CMS, with issues by field (`required`, `too-long`, `invalid-phone`, `invalid-email`, `unknown-option`) and their texts (`REQUEST_ISSUE_TEXTS`).
- The events `seamlet:request-send` (cancelable), `seamlet:request-sent` and `seamlet:request-failed` on the form let the site's code send a request its own way or follow it.

A site with forms needs a CMS that reads descriptions of 1.3. Code with an exhaustive `switch` over `SiteDescriptionProblem` gets its new members to handle.

## 1.2.1

- `site.staticPaths(content)` is what Astro's `GetStaticPaths` takes: a static site's `[...page]` route may write `satisfies GetStaticPaths` and read its props with `InferGetStaticPropsType`. `StaticPage` and `RenderedPage` became type aliases, and `staticPaths` returns a mutable array.

## 1.2.0

- `productFields()`: the fields of a product of a catalog, for the record of a collection, with its address, photos, a short and a whole description, the price with a word about it, characteristics as pairs of a name and a value, the switch that hides it and what search engines show.
- `recordPages(…, { shows })` leaves the pages of some records off the site: `site.pageOf` and `site.staticPaths` leave them out, `pathOf` gives them no address, and the preview shows them (`site.previewPageOf`), so the owner prepares a hidden record in the editor.

## 1.1.0

- Pages of records: `recordPages(schema, { collection, path: "/menu/[record]" })` gives every record of a collection a page, rendered by one component with `content`, `record` and `index`; `defineSeamletSite` takes them as `recordPages`, the site's description tells the CMS about them, and the preview shows them, a record the editor has just added too.
- `slug({ label })`: the address of a record's page, checked as an address (`invalid-slug`) and as one of a kind in its collection (`taken-slug`); `slugOf` spells it from Russian words. A record without a slug has its page at its id.
- `site.pageOf(rest, content)` and `site.staticPaths(content)` render every page of a site from one `[...page]` route, the pages of records too. `site.pageAt` renders the site's own pages only, and is deprecated.
- The preview answers an address of no page at once, without asking the CMS or reading the draft.

A site with a `slug` or pages of records needs a CMS that reads descriptions of 1.1: an older one refuses the kind `slug`. Code with an exhaustive `switch` over `Field`, `ContentIssue`, `SchemaProblemReason` or `SiteDescriptionProblem` gets their new members to handle.

## 1.0.0

The first stable version. From here the package follows semver: what a site writes against it keeps building until the next major version.

What is stable:

- `@seamlet/astro` — the integration `seamlet()`, with the site's id, title and CMS in `seamlet.json` (`CMS_ORIGIN` takes the place of `cms`).
- `@seamlet/astro/site` — `defineSeamletSite({ schema, initialContent, pages, photos })` with `pageAt`, `loadPublishedContent`, `ownPhotoAt` and `description`.
- `@seamlet/astro/schema` — the field kinds and their builders, `ContentOf`, `defaultContent`, `parseContent`, `editable`, `resolveFieldPath`, formatted text (`richTextOf`, `plainTextOf`, `linesOf`), `safeHref`, `imagePosition`, the presets, record ids, `readSiteConfig`, `readSiteDescription`, `checkSiteDescription` and `checkFields`.
- `@seamlet/astro/components/RichText.astro` and the routes the integration adds: the preview (`/preview`), the site's description (`/seamlet/site.json`), the photos taken from the CMS (`/media/<site>/<file>`) and the site's own photos for the editor (`/seamlet-photos/<address>`).
- `@seamlet/astro/protocol` — the messages between the bridge and the CMS's editor at `PROTOCOL_VERSION` 2. A change the other side cannot read raises it; the editor speaks with the bridges of earlier versions it lists.
- `npx @seamlet/astro init`.

Since 0.12.1 nothing changed in the code.

## 0.12.1

- A field that became plain text keeps the words of a formatted text saved in it.

## 0.12.0

- `safeHref`: an address no link may have never reaches markup; `RichText` and the bridge use it.
- A site the CMS would refuse stops its build with every reason (`checkSiteDescription`, `checkFields`); `readFields` refuses names with a dot or of digits, options of the wrong kind, references to a missing collection and an `itemTitle` that is no text or link.
- Requests to the CMS are bounded in time and number; `/media` answers 502 when the CMS does not.
- A draft rendered while a text is typed or the page pressed is shown once that is over.
- `init` starts a site with a title of any length and writes its modules all or none.
