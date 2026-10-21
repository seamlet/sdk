import type { Content, RecordOf } from "./content";
import type { FIELD_PATH_SEPARATOR } from "./field-paths";
import type {
  CollectionField,
  Fields,
  GroupField,
  RecordFields,
} from "./fields";
import { collectionFieldAt, isRecordId, RECORD_ID_KEY } from "./record-ids";
import { slugFieldOf } from "./slug-checks";
import { isSlug, PAGE_SEGMENT } from "./slugs";

// A page of every record of a collection: the site renders one template for all of them, and the
// owner who adds a record gets its page. The address of a page names its record: the record's slug,
// or its id while it has none, so a page outlives a rename and the moving of records.

/** What stands for the record in the address of its page: `/menu/[record]`. */
export const RECORD_PLACEHOLDER = "[record]";

/** The pages of the records of a collection, as a site describes them to the CMS. */
export interface SiteRecordPageDescription {
  /** The address of a record's page, its slug or id in place of `[record]`: `/menu/[record]`. */
  readonly path: string;
  /** The collection whose every record has a page: `menu`, or through groups, `catalog.products`. */
  readonly collection: string;
  /**
   * Where a record holds what search engines show for its page: a group of the record with a
   * `title` and a `description` text (`seo`).
   */
  readonly searchTexts?: string;
}

/** A record of a collection and its place there. */
export interface PlacedRecord {
  readonly record: Content;
  readonly index: number;
}

/** The pages of the records of a collection, with the address of each record's page. */
export interface RecordPages<R> extends SiteRecordPageDescription {
  /** The address of the record's page: `/menu/latte`; none for a record with neither slug nor id. */
  readonly pathOf: (record: R) => string | undefined;
}

/** The address of a record's page with `[record]` in place of the record. */
export type RecordPagePath = `/${string}/${typeof RECORD_PLACEHOLDER}`;

/** The paths of the collections of a schema, through its groups: `menu`, `catalog.products`. */
export type CollectionPath<F extends Fields> = {
  // By its kind: a collection of particular fields is not a collection of any fields to TypeScript.
  [Name in keyof F & string]: F[Name] extends { readonly kind: "collection" }
    ? Name
    : F[Name] extends GroupField<infer Inner>
      ? `${Name}${typeof FIELD_PATH_SEPARATOR}${CollectionPath<Inner>}`
      : never;
}[keyof F & string];

/** The fields of a record of the collection at the path of the schema. */
export type RecordFieldsAt<
  F extends Fields,
  P extends string,
> = P extends `${infer Name}${typeof FIELD_PATH_SEPARATOR}${infer Rest}`
  ? F[Name] extends GroupField<infer Inner>
    ? RecordFieldsAt<Inner, Rest>
    : never
  : F[P] extends CollectionField<infer Item extends RecordFields>
    ? Item
    : never;

/** `/menu/[record]`: the address of a page, then the record. */
const RECORD_PAGE_PATH = new RegExp(
  `^(/${PAGE_SEGMENT})+/${escaped(RECORD_PLACEHOLDER)}$`,
  "u",
);
/** What separates the segments of a page's address: `/menu/latte`. */
export const PAGE_PATH_SEPARATOR = "/";
const NOT_FOUND = -1;

/**
 * A page of every record of a collection of the schema at the address with `[record]`:
 * `recordPages(schema, { collection: "menu", path: "/menu/[record]" })`. A site gives it to
 * `defineSeamletSite` with the component that renders a record, and links to a record's page with
 * its `pathOf`.
 */
export function recordPages<
  F extends Fields,
  const P extends CollectionPath<F>,
>(
  schema: F,
  options: {
    readonly collection: P;
    readonly path: RecordPagePath;
    readonly searchTexts?: string;
  },
): RecordPages<RecordOf<RecordFieldsAt<F, P>>> {
  const collection = collectionFieldAt(schema, options.collection);
  if (collection === undefined) {
    throw new Error(
      `@seamlet/astro: the schema has no collection "${options.collection}" for the pages at "${options.path}"`,
    );
  }

  const pathOf = (record: Content) => {
    const address = recordAddressOf(collection, record);
    return address === undefined
      ? undefined
      : recordPagePath(options.path, address);
  };
  return { ...options, pathOf };
}

/** Whether the path can be the address of the pages of records: `/menu/[record]`. */
export function isRecordPagePath(path: unknown): path is string {
  return typeof path === "string" && RECORD_PAGE_PATH.test(path);
}

/** The address of a record's page: its slug, or its id while it has none. */
export function recordAddressOf<F extends RecordFields>(
  collection: CollectionField<F>,
  record: Content,
): string | undefined {
  const slugName = slugFieldOf(collection.item);
  const slug = slugName === undefined ? undefined : record[slugName];
  if (typeof slug === "string" && isSlug(slug)) return slug;

  const id = record[RECORD_ID_KEY];
  return isRecordId(id) ? id : undefined;
}

/** The address of a record's page on the site: `/menu/latte` for `/menu/[record]` and `latte`. */
export function recordPagePath(pagePath: string, address: string): string {
  return pagePath.replace(RECORD_PLACEHOLDER, address);
}

/**
 * The pages of records the path is the address of, with the record's part of it: `/menu/latte` is
 * `latte` of `/menu/[record]`.
 */
export function recordPageAt<P extends SiteRecordPageDescription>(
  pages: readonly P[],
  path: string,
): { readonly page: P; readonly address: string } | undefined {
  for (const page of pages) {
    const address = addressUnder(page.path, path);
    if (address !== undefined) return { page, address };
  }
  return undefined;
}

/**
 * The record at the address of its page: the record whose page it is, or the record with that id,
 * as the editor opens a page, since a slug may change while the page is open.
 */
export function recordAt<F extends RecordFields>(
  collection: CollectionField<F>,
  records: readonly Content[],
  address: string,
): PlacedRecord | undefined {
  const pageIndex = records.findIndex(
    (record) => recordAddressOf(collection, record) === address,
  );
  const index =
    pageIndex === NOT_FOUND
      ? records.findIndex((record) => record[RECORD_ID_KEY] === address)
      : pageIndex;
  const record = records[index];
  return record === undefined ? undefined : { record, index };
}

/** The record's part of the path when it is a page of the pages at the record page path. */
function addressUnder(
  recordPagePath: string,
  path: string,
): string | undefined {
  const prefix = recordPagePath.slice(0, -RECORD_PLACEHOLDER.length);
  if (!path.startsWith(prefix)) return undefined;

  const address = path.slice(prefix.length);
  const isOneSegment = address !== "" && !address.includes(PAGE_PATH_SEPARATOR);
  return isOneSegment ? address : undefined;
}

function escaped(text: string): string {
  return text.replace(/[[\]]/gu, "\\$&");
}
