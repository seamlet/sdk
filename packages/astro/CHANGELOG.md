# Changelog

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

A site with a `slug` or pages of records needs a CMS that reads descriptions of 1.1 (cms.seamlet.ru from its release 1.1.0): an older one refuses the kind `slug`. Code with an exhaustive `switch` over `Field`, `ContentIssue`, `SchemaProblemReason` or `SiteDescriptionProblem` gets their new members to handle.

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
