# Changelog

## 2.8.2

- The outline of a block scrolled half above the screen stays under a sticky header. The bridge cut a box by a header fixed over it only when the header covered the box's own top, so a section that began above the screen, a header stuck over its middle, was reported whole, and the CMS's editor drew its outline over the header, up to the edge of the page. A fixed part now covers the top or the bottom of what the screen shows of a box.

## 2.8.1

- A tap on a text of the preview selects it on an iPhone. The bridge listened to clicks on the document, and Safari sends a tap's click only where something listens to clicks: a listener on the document does not count for it, so a tap on a paragraph, a heading or a price clicked nothing there and the editor chose no field. The bridge now listens on the root element, which Safari counts, before the site's own listeners as before.

## 2.8.0

- A new field kind, `words({ label })`: a list of words or short phrases the site shows apart, as tags (the notes of a coffee's taste, «Бергамот, персик, мёд»). Its value is a list of strings, kept trimmed, none empty and none twice, in the order given (`normalWords`). A text saved in the field before it became a list is read as its words between commas, semicolons or line breaks (`wordsOf`), so a site turns a `text` «через запятую» into `words` without losing what the owner wrote; a `words` field that becomes a `text` again keeps them between commas (`wordsTextOf`, `WORDS_SEPARATOR`). A CMS reads a schema with a `words` field only from 2.8.0 on: the CMS takes 2.8.0 before a site uses it.
- `start-typing`, `start-rich-typing`, `start-value-typing` and `scroll-to` may say `copy`: which of the elements marked with the path to type or to bring into view, in the order of the page, from 0. The editor names it when no click chose the element, as when Tab takes a typing to the next field: a field the page shows twice (a phone in the header and in the contacts) is typed and shown where Tab went, not at its first copy. A copy a click made ready, or the one at the message's `point`, still comes first.

The protocol keeps version 3: a bridge before 2.8.0 ignores `copy` and takes the first copy, as before.

## 2.7.0

The bridge tells the CMS's editor where a marked element is seen, so the editor's outlines stay on what a person sees. The protocol keeps version 3: everything new is an addition an older editor does not read.

- `layout` says, beside the box of every marked element, `shown`: the part of the box a person sees, cut by the parts around it that clip what overflows them (a strip that scrolls sideways, a card with rounded corners) and by the parts fixed over it across its width (a sticky header, a bar at the bottom of the screen), or `null` when none of it is seen. The element stays in `markers` either way, so the editor still knows the page shows it. `seenBoxOf(marker)` of `@seamlet/astro/protocol` reads it, and takes the whole box of a bridge before 2.7.0 as seen. An outline of a field scrolled under a sticky header no longer lies over the header.
- `pickedPathAt` and `rankedMarkersAt` choose by the seen part, so a click on a sticky header never chooses a field under it, and the link and the text of the site's own under the pointer are reported by their seen part too.
- `hover` says `copy`, which of the elements marked with its path the pointer is over, in the order of the page, from 0: a page may show a field more than once (a section's name on its tile and on a chip of a filter), and the editor outlines the one hovered.
- A typing goes into the copy of the field a click made ready, or the copy at its `point`, instead of the first one: typing a field shown twice no longer jumps the page to its first copy.
- The check of covered fields in the console of the editor's frame tries the seen part of a field, so a field scrolled under a sticky header is checked once it comes out, and takes a field as reachable when a click chooses it by the rule of the editor, so a price under its card's stretched link is no longer reported.

The order of updates does not matter: an editor of 2.6.0 ignores `shown` and `copy`, and an editor of 2.7.0 takes the whole box and the first copy from a bridge of 2.6.0.

## 2.6.0

The bridge on the preview speaks version 3 of the protocol with the CMS's editor (`PROTOCOL_VERSION` is 3):

- A click chooses the smallest marked element whose box holds its point, in the block around the element it landed on, not the element on top: a price or a photo under a card's name stretched as a link over the card is chosen where it is, and a tap gives the focus and a phone's keyboard to that element at once. `pickedPathAt` and `rankedMarkersAt` of `@seamlet/astro/protocol` are the one rule, which the editor applies to the boxes of any bridge.
- A number and a time are typed right on the page: `start-value-typing` (`{ path, kind: "number", value }` or `{ path, kind: "time", value }`, with an optional `point`) types a number its element shows alone, with spaces between thousands or a decimal comma too («1 990», «2,5»), and a time it shows as it is («19:00»); while typed, a number takes only digits, spaces and a comma, a time digits and a colon. The page answers with `typing-started` or `typing-refused`, sends the words in `typed` (the editor reads them by its own rule; `numberShownBy` is how the bridge reads a shown number) and ends with `typing-ended`.
- A tap on the words of a link, a number or a time makes them ready to be typed, as on a text, so a phone shows its keyboard.
- Texts of the site's own: `static-hover` (`{ box }`, or `{ box: undefined }` when the pointer leaves) says where a hovered text outside every marked element is, `data-cms-fixed` or not, and a click outside the marked elements says `isStaticText`, so the editor can say that a developer changes it.
- A click on a field carries `shownText`, the words its element shows when it shows that field alone, so the editor can quote a phrase the site builds around a value («обжарено 4 дня назад»).
- Tab and Shift+Tab while a text is typed end the typing and say `key` with `next-field` or `previous-field`; elsewhere Tab moves the focus as always.
- Escape ends a typing in place with `kept` and leaves the typed text in its element; the editor's undo takes it back. No bridge 3 typing ends `reverted`.
- `start-typing` and `start-rich-typing` may come without `point`: the caret goes after the text.

Formatted text, opening `<details>`, tabs and filters, and holding moving parts are as they were.

The order of updates: the CMS takes 2.6.0 first. An editor speaks with bridges up to its own `PROTOCOL_VERSION`, so an editor of 2.5.0 or older does not speak with a page of 2.6.0 and says that the site must be updated. An editor of 2.6.0 speaks with bridges 1 to 3 and asks a bridge before 3 only for what it does. Then sites update the package when they like.

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
