import {
  checkSiteDescription,
  formatFieldPath,
  type ContentIssue,
  type Fields,
  type PageProblemReason,
  type SchemaProblemReason,
  type SiteConfig,
  type SiteDescription,
  type SiteDescriptionProblem,
  type SitePageDescription,
} from "./schema";
import type { SeamletSiteDefinition } from "./site";
import { SITE_MODULE_FILE } from "./site-addresses";

// What a site tells the CMS about itself, from its config and its definition: everything but how it
// renders. It is checked here exactly as the CMS reads it, so a site the CMS would refuse stops its
// own build and says what to fix.

/** How the site is named in the CMS: from its `seamlet.json`. */
export type SiteIdentity = Pick<SiteConfig, "id" | "title">;

export function describeSite<F extends Fields>(
  identity: SiteIdentity,
  definition: SeamletSiteDefinition<F>,
): SiteDescription {
  const pages = Object.entries(definition.pages).map(
    ([path, page]): SitePageDescription => ({
      path,
      title: page.title,
      ...(page.searchTexts === undefined
        ? {}
        : { searchTexts: page.searchTexts }),
    }),
  );
  const description = {
    id: identity.id,
    title: identity.title,
    schema: definition.schema,
    initialContent: definition.initialContent,
    pages,
  };

  // The CMS gets the description as JSON: it is checked as the CMS will see it.
  const asSent: unknown = JSON.parse(JSON.stringify(description));
  const reading = checkSiteDescription(asSent);
  if (reading.status === "invalid") {
    throw new Error(refusalMessage(identity.id, reading.problems));
  }
  return reading.description;
}

function refusalMessage(
  id: string,
  problems: readonly SiteDescriptionProblem[],
): string {
  const lines = problems.map((problem) => `  - ${problemText(problem)}`);
  return [
    `@seamlet/astro: the CMS would refuse the site "${id}" (${SITE_MODULE_FILE}):`,
    ...lines,
  ].join("\n");
}

function problemText(problem: SiteDescriptionProblem): string {
  switch (problem.code) {
    case "not-a-description":
      return "the site describes nothing";
    case "invalid-id":
      return "its id in seamlet.json is not one";
    case "invalid-title":
      return "its title in seamlet.json is empty";
    case "invalid-schema": {
      const path = formatFieldPath(problem.problem.path);
      const where = path === "" ? "the schema" : `the field "${path}"`;
      return `${where}: ${SCHEMA_PROBLEM_TEXTS[problem.problem.reason]}`;
    }
    case "invalid-initial-content":
      return `the initial content: ${problem.issues.map(issueText).join("; ")}`;
    case "no-pages":
      return "it has no pages";
    case "invalid-page":
      return `page ${String(problem.index + 1)} of pages: ${PAGE_PROBLEM_TEXTS[problem.reason]}`;
    case "home-page-not-first":
      return 'the first of the pages is not the home page "/"';
    case "repeated-page-path":
      return `the page "${problem.path}" is named twice`;
  }
}

const SCHEMA_PROBLEM_TEXTS: Readonly<Record<SchemaProblemReason, string>> = {
  "not-fields": "not fields of the schema language",
  "invalid-name": "a field's name must not be empty, hold a dot or be a number",
  "invalid-label": "its label is not a text",
  "unknown-kind": "a kind of field the schema language does not have",
  "invalid-option": "an option of the field is not of its kind",
  "invalid-choice-options": "its options are not a list of { value, label }",
  "record-id-field": "a record has its own id: name the field otherwise",
  "invalid-item-title": "itemTitle names no text or link field of the record",
  "unknown-collection": "it refers to a collection the schema does not have",
};

const PAGE_PROBLEM_TEXTS: Readonly<Record<PageProblemReason, string>> = {
  "not-a-page": "not a page",
  "invalid-path":
    'its address is not "/" or lower-case segments without a trailing slash, such as "/menu"',
  "invalid-title": "its title is empty",
  "invalid-search-texts":
    "searchTexts names no group of a title and a description text",
};

function issueText(issue: ContentIssue): string {
  return `"${formatFieldPath(issue.path)}" is ${issue.code}`;
}
