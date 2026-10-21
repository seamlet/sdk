import type { Content } from "./content";
import { resolveFieldPath } from "./field-paths";
import type { Fields } from "./fields";
import { isJsonObject, isText } from "./json-values";
import { parseContent, type ContentIssue } from "./parse-content";
import { checkFields, type SchemaProblem } from "./read-fields";
import {
  readRequestForm,
  type RequestForm,
  type RequestFormProblemReason,
} from "./request-forms";
import { collectionAt, collectionFieldAt } from "./record-ids";
import {
  isRecordPagePath,
  recordAddressOf,
  recordPageAt,
  type SiteRecordPageDescription,
} from "./record-pages";
import { isSiteId } from "./site-config";
import { PAGE_SEGMENT } from "./slugs";

// What a site tells the CMS about itself: its id, its name, the schema of its content, the content
// it starts with, its pages and the forms its visitors send requests with. The site hands it out (`SITE_DESCRIPTION_PATH`), the CMS takes it
// from there, so connecting a site or changing its schema needs no change of the CMS.

/** Where a site hands out its description, on the origin of its preview. */
export const SITE_DESCRIPTION_PATH = "/seamlet/site.json";

/** A page of a site, which the site renders itself. */
export interface SitePageDescription {
  /** The address of the page on the site: `/` for the first page, `/menu` for others. */
  readonly path: string;
  /** How the editor names the page in its list of pages. */
  readonly title: string;
  /**
   * Where the content holds what search engines and link previews show for the page
   * (`seo.menu`): a group of a `title` and a `description` text.
   */
  readonly searchTexts?: string;
}

export interface SiteDescription {
  /** The address of the site in the CMS (`/sites/<id>`). */
  readonly id: string;
  /** How the CMS names the site. */
  readonly title: string;
  readonly schema: Fields;
  /** The content shown and edited until the first save. */
  readonly initialContent: Content;
  /** The pages of the site; the first is the home page at `/`. */
  readonly pages: readonly [SitePageDescription, ...SitePageDescription[]];
  /** The pages of the records of collections; left out when the site has none. */
  readonly recordPages?: readonly SiteRecordPageDescription[];
  /** The forms of the site's requests; left out when the site has none. */
  readonly forms?: readonly RequestForm[];
}

/** Why a site's description cannot be read: what to fix in the site. */
export type SiteDescriptionProblem =
  | { readonly code: "not-a-description" }
  | { readonly code: "invalid-id" }
  | { readonly code: "invalid-title" }
  | { readonly code: "invalid-schema"; readonly problem: SchemaProblem }
  /** The initial content is not content the CMS could save. */
  | {
      readonly code: "invalid-initial-content";
      readonly issues: readonly ContentIssue[];
    }
  | { readonly code: "no-pages" }
  /** The page at this place of the list is not a page, or its path or title is not one. */
  | {
      readonly code: "invalid-page";
      readonly index: number;
      readonly reason: PageProblemReason;
    }
  | { readonly code: "home-page-not-first" }
  | { readonly code: "repeated-page-path"; readonly path: string }
  /** The pages of records are not a list. */
  | { readonly code: "invalid-record-pages" }
  /** The pages of records at this place of their list are not such pages, or not of this site. */
  | {
      readonly code: "invalid-record-page";
      readonly index: number;
      readonly reason: RecordPageProblemReason;
    }
  /** Two kinds of pages for the records of one collection: a record has one page. */
  | { readonly code: "repeated-record-pages"; readonly collection: string }
  /** A page of the site where the pages of records are: `/menu/specials` beside `/menu/[record]`. */
  | {
      readonly code: "page-among-record-pages";
      readonly path: string;
    }
  /** A record of the initial content whose page has no address: neither a slug nor an id. */
  | {
      readonly code: "record-without-address";
      readonly collection: string;
      readonly index: number;
    }
  /** Two records of the initial content whose pages have one address: the same id, or slug. */
  | {
      readonly code: "repeated-record-address";
      readonly collection: string;
      readonly address: string;
    }
  /** The forms are not a list. */
  | { readonly code: "invalid-forms" }
  /** The form at this place of the list is not one. */
  | {
      readonly code: "invalid-form";
      readonly index: number;
      readonly reason: RequestFormProblemReason;
    }
  /** Two forms with one id: a request names its form by it. */
  | { readonly code: "repeated-form-id"; readonly id: string };

export type PageProblemReason =
  | "not-a-page"
  /** Not `/`, or not lower-case segments without a trailing slash, such as `/menu`. */
  | "invalid-path"
  | "invalid-title"
  /** Not where the content holds a group of a `title` and a `description` text. */
  | "invalid-search-texts";

export type RecordPageProblemReason =
  | "not-a-page"
  /** Not the address of a page, then `/[record]`, such as `/menu/[record]`. */
  | "invalid-path"
  /** Not a collection of the schema. */
  | "unknown-collection"
  /** Not where a record holds a group of a `title` and a `description` text. */
  | "invalid-search-texts";

export type SiteDescriptionReading =
  | { readonly status: "read"; readonly description: SiteDescription }
  | {
      readonly status: "invalid";
      readonly problems: readonly SiteDescriptionProblem[];
    };

/** `/menu`, `/about/team`: lower-case segments, no trailing slash. */
const PAGE_PATH = new RegExp(`^(/${PAGE_SEGMENT})+$`, "u");
/** The first page of every site. */
export const HOME_PAGE_PATH = "/";

/**
 * The description the input gives, or undefined when it is not a whole and sound one: a known
 * schema, an initial content with nothing to fix, the home page first, each page once.
 */
export function readSiteDescription(
  input: unknown,
): SiteDescription | undefined {
  const reading = checkSiteDescription(input);
  return reading.status === "read" ? reading.description : undefined;
}

/** The description the input gives, or every problem that keeps it from being whole and sound. */
export function checkSiteDescription(input: unknown): SiteDescriptionReading {
  if (!isJsonObject(input)) return invalid([{ code: "not-a-description" }]);

  const { id, title } = input;
  const nameProblems = namingProblems(id, title);
  const schema = checkFields(input["schema"]);
  if (schema.status === "invalid") {
    const { problem } = schema;
    return invalid([...nameProblems, { code: "invalid-schema", problem }]);
  }

  const initial = parseContent(schema.fields, input["initialContent"]);
  const pages = checkPages(schema.fields, input["pages"]);
  const recordPages = checkRecordPages(schema.fields, input["recordPages"]);
  const forms = checkForms(input["forms"]);
  const problems = [
    ...nameProblems,
    ...initialContentProblems(initial.issues),
    ...pages.problems,
    ...recordPages.problems,
    ...placementProblems(pages.pages ?? [], recordPages.pages ?? []),
    ...addressProblems(schema.fields, initial.content, recordPages.pages ?? []),
    ...forms.problems,
  ];
  const isNamed = isSiteId(id) && isText(title);
  const isWhole =
    pages.pages !== undefined &&
    recordPages.pages !== undefined &&
    forms.forms !== undefined;
  if (!isNamed || !isWhole || problems.length > 0) {
    return invalid(problems);
  }

  const description = {
    id,
    title,
    schema: schema.fields,
    initialContent: initial.content,
    pages: pages.pages,
    ...(recordPages.pages.length === 0
      ? {}
      : { recordPages: recordPages.pages }),
    ...(forms.forms.length === 0 ? {} : { forms: forms.forms }),
  };
  return { status: "read", description };
}

/** Whether the path names a group of a `title` and a `description` text. */
export function isSearchTextsGroup(schema: Fields, path: string): boolean {
  const target = resolveFieldPath(schema, path);
  if (target?.kind !== "field" || target.field.kind !== "group") return false;

  const { title, description } = target.field.fields;
  return title?.kind === "text" && description?.kind === "text";
}

function namingProblems(
  id: unknown,
  title: unknown,
): readonly SiteDescriptionProblem[] {
  const idProblems = isSiteId(id) ? [] : [{ code: "invalid-id" } as const];
  const titleProblems = isText(title)
    ? []
    : [{ code: "invalid-title" } as const];
  return [...idProblems, ...titleProblems];
}

function initialContentProblems(
  issues: readonly ContentIssue[],
): readonly SiteDescriptionProblem[] {
  return issues.length > 0 ? [{ code: "invalid-initial-content", issues }] : [];
}

interface PagesReading {
  readonly pages: SiteDescription["pages"] | undefined;
  readonly problems: readonly SiteDescriptionProblem[];
}

function checkPages(schema: Fields, input: unknown): PagesReading {
  if (!Array.isArray(input) || input.length === 0) {
    return { pages: undefined, problems: [{ code: "no-pages" }] };
  }

  const entries: readonly unknown[] = input;
  const readings = entries.map((entry) => readPage(schema, entry));
  const pageProblems = readings.flatMap((reading, index) =>
    typeof reading === "string"
      ? [{ code: "invalid-page", index, reason: reading } as const]
      : [],
  );
  const pages = readings.filter((reading) => typeof reading !== "string");
  const problems = [...pageProblems, ...orderProblems(pages)];
  const [first, ...rest] = pages;
  const isSound = problems.length === 0 && first !== undefined;
  return { pages: isSound ? [first, ...rest] : undefined, problems };
}

/** The home page first, and every path once. */
function orderProblems(
  pages: readonly SitePageDescription[],
): readonly SiteDescriptionProblem[] {
  const paths = pages.map((page) => page.path);
  const repeated = paths.filter((path, index) => paths.indexOf(path) !== index);
  const isHomeMissing = paths.length > 0 && paths[0] !== HOME_PAGE_PATH;
  const homeProblems = isHomeMissing
    ? [{ code: "home-page-not-first" } as const]
    : [];
  const repeatProblems = [...new Set(repeated)].map(
    (path) => ({ code: "repeated-page-path", path }) as const,
  );
  return [...homeProblems, ...repeatProblems];
}

/** The page the input describes, or why it is not one. */
function readPage(
  schema: Fields,
  input: unknown,
): SitePageDescription | PageProblemReason {
  if (!isJsonObject(input)) return "not-a-page";
  const { path, title, searchTexts } = input;
  if (!isPagePath(path)) return "invalid-path";
  if (!isText(title)) return "invalid-title";
  if (searchTexts === undefined) return { path, title };

  const isSearchTexts =
    typeof searchTexts === "string" && isSearchTextsGroup(schema, searchTexts);
  return isSearchTexts ? { path, title, searchTexts } : "invalid-search-texts";
}

interface RecordPagesReading {
  readonly pages: readonly SiteRecordPageDescription[] | undefined;
  readonly problems: readonly SiteDescriptionProblem[];
}

/** The pages of records the input lists; none when it lists none. */
function checkRecordPages(schema: Fields, input: unknown): RecordPagesReading {
  if (input === undefined) return { pages: [], problems: [] };
  if (!Array.isArray(input)) {
    return { pages: undefined, problems: [{ code: "invalid-record-pages" }] };
  }

  const entries: readonly unknown[] = input;
  const readings = entries.map((entry) => readRecordPage(schema, entry));
  const pageProblems = readings.flatMap((reading, index) =>
    typeof reading === "string"
      ? [{ code: "invalid-record-page", index, reason: reading } as const]
      : [],
  );
  const pages = readings.filter((reading) => typeof reading !== "string");
  const problems = [...pageProblems, ...recordPageRepeats(pages)];
  return { pages: problems.length === 0 ? pages : undefined, problems };
}

/** Every address once, and one kind of page for the records of a collection. */
function recordPageRepeats(
  pages: readonly SiteRecordPageDescription[],
): readonly SiteDescriptionProblem[] {
  const paths = pages.map((page) => page.path);
  const collections = pages.map((page) => page.collection);
  const repeatedPaths = paths.filter(
    (path, index) => paths.indexOf(path) !== index,
  );
  const repeatedCollections = collections.filter(
    (collection, index) => collections.indexOf(collection) !== index,
  );
  const pathProblems = [...new Set(repeatedPaths)].map(
    (path) => ({ code: "repeated-page-path", path }) as const,
  );
  const collectionProblems = [...new Set(repeatedCollections)].map(
    (collection) => ({ code: "repeated-record-pages", collection }) as const,
  );
  return [...pathProblems, ...collectionProblems];
}

/** The page of records the input describes, or why it is not one. */
function readRecordPage(
  schema: Fields,
  input: unknown,
): SiteRecordPageDescription | RecordPageProblemReason {
  if (!isJsonObject(input)) return "not-a-page";
  const { path, collection, searchTexts } = input;
  if (!isRecordPagePath(path)) return "invalid-path";
  if (typeof collection !== "string") return "unknown-collection";
  const field = collectionFieldAt(schema, collection);
  if (field === undefined) return "unknown-collection";
  if (searchTexts === undefined) return { path, collection };

  const isSearchTexts =
    typeof searchTexts === "string" &&
    isSearchTextsGroup(field.item, searchTexts);
  return isSearchTexts
    ? { path, collection, searchTexts }
    : "invalid-search-texts";
}

interface FormsReading {
  readonly forms: readonly RequestForm[] | undefined;
  readonly problems: readonly SiteDescriptionProblem[];
}

/** The forms the input lists, each id once; none when it lists none. */
function checkForms(input: unknown): FormsReading {
  if (input === undefined) return { forms: [], problems: [] };
  if (!Array.isArray(input)) {
    return { forms: undefined, problems: [{ code: "invalid-forms" }] };
  }

  const entries: readonly unknown[] = input;
  const readings = entries.map((entry) => readRequestForm(entry));
  const formProblems = readings.flatMap((reading, index) =>
    reading.status === "invalid"
      ? [{ code: "invalid-form", index, reason: reading.reason } as const]
      : [],
  );
  const forms = readings.flatMap((reading) =>
    reading.status === "read" ? [reading.form] : [],
  );
  const ids = forms.map((form) => form.id);
  const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
  const repeatProblems = [...new Set(repeated)].map(
    (id) => ({ code: "repeated-form-id", id }) as const,
  );
  const problems = [...formProblems, ...repeatProblems];
  return { forms: problems.length === 0 ? forms : undefined, problems };
}

/** The pages of the site where the pages of records are: a record could never have that address. */
function placementProblems(
  pages: readonly SitePageDescription[],
  recordPages: readonly SiteRecordPageDescription[],
): readonly SiteDescriptionProblem[] {
  const misplaced = pages.filter(
    (page) => recordPageAt(recordPages, page.path) !== undefined,
  );
  return misplaced.map(
    (page) => ({ code: "page-among-record-pages", path: page.path }) as const,
  );
}

/**
 * The records of the initial content whose pages have no address, or the address of another: a
 * record the CMS saves has an id of its own, the initial content is the site's own.
 */
function addressProblems(
  schema: Fields,
  initialContent: Content,
  recordPages: readonly SiteRecordPageDescription[],
): readonly SiteDescriptionProblem[] {
  return recordPages.flatMap((page) => {
    const found = collectionAt(schema, initialContent, page.collection);
    if (found === undefined) return [];

    const addresses = found.records.map((record) =>
      recordAddressOf(found.collection, record),
    );
    return addresses.flatMap((_, index) =>
      recordAddressProblems(page.collection, addresses, index),
    );
  });
}

function recordAddressProblems(
  collection: string,
  addresses: readonly (string | undefined)[],
  index: number,
): readonly SiteDescriptionProblem[] {
  const address = addresses[index];
  if (address === undefined) {
    return [{ code: "record-without-address", collection, index }];
  }

  const isRepeated = addresses.indexOf(address) < index;
  return isRepeated
    ? [{ code: "repeated-record-address", collection, address }]
    : [];
}

function isPagePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    (path === HOME_PAGE_PATH || PAGE_PATH.test(path))
  );
}

function invalid(
  problems: readonly SiteDescriptionProblem[],
): SiteDescriptionReading {
  return { status: "invalid", problems };
}
