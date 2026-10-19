import type { Content } from "./content";
import { resolveFieldPath } from "./field-paths";
import type { Fields } from "./fields";
import { isJsonObject, isText } from "./json-values";
import { parseContent, type ContentIssue } from "./parse-content";
import { checkFields, type SchemaProblem } from "./read-fields";
import { isSiteId } from "./site-config";

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
  | { readonly code: "repeated-page-path"; readonly path: string };

export type PageProblemReason =
  | "not-a-page"
  /** Not `/`, or not lower-case segments without a trailing slash, such as `/menu`. */
  | "invalid-path"
  | "invalid-title"
  /** Not where the content holds a group of a `title` and a `description` text. */
  | "invalid-search-texts";

export type SiteDescriptionReading =
  | { readonly status: "read"; readonly description: SiteDescription }
  | {
      readonly status: "invalid";
      readonly problems: readonly SiteDescriptionProblem[];
    };

/** `/menu`, `/about/team`: lower-case segments, no trailing slash. */
const PAGE_PATH = /^(\/[a-z0-9][a-z0-9-]*)+$/u;
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
  const problems = [
    ...nameProblems,
    ...initialContentProblems(initial.issues),
    ...pages.problems,
  ];
  const isNamed = isSiteId(id) && isText(title);
  if (!isNamed || pages.pages === undefined || problems.length > 0) {
    return invalid(problems);
  }

  const description = {
    id,
    title,
    schema: schema.fields,
    initialContent: initial.content,
    pages: pages.pages,
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
