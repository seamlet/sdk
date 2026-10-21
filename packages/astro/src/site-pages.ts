import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import {
  collectionAt,
  HOME_PAGE_PATH,
  PAGE_PATH_SEPARATOR,
  recordAddressOf,
  recordAt,
  recordPageAt,
  recordPagePath,
  type Content,
  type Fields,
  type SiteRecordPages,
} from "./schema";

// What renders each page of a site with its content. A page of the site takes the content; a page of
// a record takes the record and its place in its collection too, so its markers point at the
// record's fields: `edit("menu", index, "name")`.

/** A page of the site: how the editor names it, and the component that renders it. */
export interface SeamletPage {
  readonly title: string;
  /** A component that takes the site's content as its `content` prop. */
  readonly component: AstroComponentFactory;
  /** Where the content holds the page's title and description for search engines (`seo.menu`). */
  readonly searchTexts?: string;
}

/** The pages of the records of a collection, and the component that renders each of them. */
export interface SeamletRecordPage {
  /** Which records have pages and where: `recordPages(schema, { collection, path })`. */
  readonly pages: SiteRecordPages;
  /**
   * A component that takes the site's content, the record and its place in its collection as its
   * `content`, `record` and `index` props.
   */
  readonly component: AstroComponentFactory;
}

/** What renders a page: its component, and the props to give it. */
export interface RenderedPage {
  readonly component: AstroComponentFactory;
  readonly props: PageProps;
}

export type PageProps =
  | { readonly content: Content }
  | {
      readonly content: Content;
      readonly record: Content;
      readonly index: number;
    };

/** A page that `getStaticPaths` of a site's `[...page]` route builds. */
export interface StaticPage {
  readonly params: { readonly page: string | undefined };
  readonly props: RenderedPage;
}

/** The pages of a site as its definition gives them. */
export interface SitePages {
  readonly schema: Fields;
  readonly pages: Readonly<Record<string, SeamletPage>>;
  readonly recordPages: readonly SeamletRecordPage[];
}

/** The page's address from the rest a `[...page]` route has: nothing is `/`, `menu` is `/menu`. */
export function pagePathOf(rest: string | undefined): string {
  return rest === undefined ? HOME_PAGE_PATH : `${PAGE_PATH_SEPARATOR}${rest}`;
}

/** The rest a `[...page]` route has for the page at the address: none for `/`. */
export function pageParameterOf(path: string): string | undefined {
  return path === HOME_PAGE_PATH
    ? undefined
    : path.slice(PAGE_PATH_SEPARATOR.length);
}

/** Which records' pages are shown: on the site, or in the preview. */
type ShownRecords = (recordPage: SeamletRecordPage, record: Content) => boolean;

/** The site shows the pages its pages of records show. */
const SHOWN_ON_SITE: ShownRecords = (recordPage, record) =>
  recordPage.pages.isShown?.(record) ?? true;
/** The preview shows the page of every record, so the owner prepares a hidden one. */
const EVERY_RECORD: ShownRecords = () => true;

/** What renders the page at the address with the content; undefined when the site has no such page. */
export function renderedPageAt(
  site: SitePages,
  path: string,
  content: Content,
): RenderedPage | undefined {
  return (
    ownPageAt(site, path, content) ??
    renderedRecordPageAt(site, { path, content, isShown: SHOWN_ON_SITE })
  );
}

/** What renders the page at the address in the preview: the page of a hidden record too. */
export function previewedPageAt(
  site: SitePages,
  path: string,
  content: Content,
): RenderedPage | undefined {
  return (
    ownPageAt(site, path, content) ??
    renderedRecordPageAt(site, { path, content, isShown: EVERY_RECORD })
  );
}

/** Every page of the site with the content: its own pages, and a page of every record that has one. */
export function staticPagesOf(
  site: SitePages,
  content: Content,
): readonly StaticPage[] {
  const ownPages = Object.entries(site.pages).map(([path, page]) =>
    staticPage(path, { component: page.component, props: { content } }),
  );
  const recordPages = site.recordPages.flatMap((recordPage) =>
    staticRecordPagesOf(site.schema, recordPage, content),
  );
  return [...ownPages, ...recordPages];
}

function ownPageAt(
  site: SitePages,
  path: string,
  content: Content,
): RenderedPage | undefined {
  const page = Object.hasOwn(site.pages, path) ? site.pages[path] : undefined;
  return page === undefined
    ? undefined
    : { component: page.component, props: { content } };
}

interface RecordPageRequest {
  readonly path: string;
  readonly content: Content;
  readonly isShown: ShownRecords;
}

function renderedRecordPageAt(
  site: SitePages,
  request: RecordPageRequest,
): RenderedPage | undefined {
  const { path, content, isShown } = request;
  const described = site.recordPages.map((recordPage) => ({
    ...recordPage.pages,
    recordPage,
  }));
  const found = recordPageAt(described, path);
  if (found === undefined) return undefined;
  const records = collectionAt(site.schema, content, found.page.collection);
  if (records === undefined) return undefined;

  const placed = recordAt(records.collection, records.records, found.address);
  const { recordPage } = found.page;
  if (placed === undefined || !isShown(recordPage, placed.record)) {
    return undefined;
  }

  const props = { content, record: placed.record, index: placed.index };
  return { component: recordPage.component, props };
}

function staticRecordPagesOf(
  schema: Fields,
  recordPage: SeamletRecordPage,
  content: Content,
): readonly StaticPage[] {
  const found = collectionAt(schema, content, recordPage.pages.collection);
  if (found === undefined) return [];

  return found.records.flatMap((record, index) => {
    const address = recordAddressOf(found.collection, record);
    const hasPage = address !== undefined && SHOWN_ON_SITE(recordPage, record);
    if (!hasPage) return [];

    const path = recordPagePath(recordPage.pages.path, address);
    const props = { content, record, index };
    return [staticPage(path, { component: recordPage.component, props })];
  });
}

function staticPage(path: string, page: RenderedPage): StaticPage {
  return { params: { page: pageParameterOf(path) }, props: page };
}
