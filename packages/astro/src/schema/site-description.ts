import type { Content } from "./content";
import { resolveFieldPath } from "./field-paths";
import type { Fields } from "./fields";
import { parseContent } from "./parse-content";
import { readFields } from "./read-fields";

// What a site tells the CMS about itself: its id, its name, the schema of its content, the content
// it starts with and its pages. The site hands it out (`SITE_DESCRIPTION_PATH`), the CMS takes it
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
}

/** An id is a part of addresses and of file names: lower-case letters, digits and hyphens. */
const SITE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
/** `/menu`, `/about/team`: lower-case segments, no trailing slash. */
const PAGE_PATH = /^(\/[a-z0-9][a-z0-9-]*)+$/u;
const HOME_PAGE_PATH = "/";

/**
 * The description the input gives, or undefined when it is not a whole and sound one: a known
 * schema, an initial content with nothing to fix, the home page first, each page once.
 */
export function readSiteDescription(
  input: unknown,
): SiteDescription | undefined {
  if (!isRecord(input)) return undefined;
  const { id, title } = input;
  const schema = readFields(input["schema"]);
  const isNamed = typeof id === "string" && SITE_ID.test(id) && isText(title);
  if (!isNamed || schema === undefined) return undefined;

  const initial = parseContent(schema, input["initialContent"]);
  const pages = readPages(schema, input["pages"]);
  if (initial.issues.length > 0 || pages === undefined) return undefined;
  return { id, title, schema, initialContent: initial.content, pages };
}

/** Whether the path names a group of a `title` and a `description` text. */
export function isSearchTextsGroup(schema: Fields, path: string): boolean {
  const target = resolveFieldPath(schema, path);
  if (target?.kind !== "field" || target.field.kind !== "group") return false;

  const { title, description } = target.field.fields;
  return title?.kind === "text" && description?.kind === "text";
}

function readPages(
  schema: Fields,
  input: unknown,
): SiteDescription["pages"] | undefined {
  if (!Array.isArray(input)) return undefined;
  const entries: unknown[] = input;
  const pages = entries.map((entry) => readPage(schema, entry));
  const read = pages.flatMap((page) => (page === undefined ? [] : [page]));
  const [first, ...rest] = read;
  const paths = new Set(read.map((page) => page.path));
  const isSound =
    read.length === pages.length &&
    first?.path === HOME_PAGE_PATH &&
    paths.size === read.length;
  return isSound ? [first, ...rest] : undefined;
}

function readPage(
  schema: Fields,
  input: unknown,
): SitePageDescription | undefined {
  if (!isRecord(input)) return undefined;
  const { path, title, searchTexts } = input;
  const isPath =
    typeof path === "string" &&
    (path === HOME_PAGE_PATH || PAGE_PATH.test(path));
  if (!isPath || !isText(title)) return undefined;
  if (searchTexts === undefined) return { path, title };

  const isSearchTexts =
    typeof searchTexts === "string" && isSearchTextsGroup(schema, searchTexts);
  return isSearchTexts ? { path, title, searchTexts } : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
