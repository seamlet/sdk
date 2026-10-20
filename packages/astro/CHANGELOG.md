# Changelog

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
