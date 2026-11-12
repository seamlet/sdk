import { formatFieldPath, isJsonObject, type ContentIssue } from "./schema";
import type { PublishedAnswer } from "./published-answers";
import { CONTENT_COPY_FILE } from "./site-addresses";

// The copy of the published content in the site's own repository (`seamlet/content.json`), which
// the CMS commits on every publication and its archive of the content holds too: a site builds
// from it while the CMS does not answer, and for good once its owner has left the CMS.

/** The environment variable that makes a build take the content from the copy alone. */
export const CONTENT_SOURCE_VARIABLE = "SEAMLET_CONTENT";
const COPY_ONLY = "copy";
/** The issues named in a warning; the rest are counted. */
const MOST_ISSUES_NAMED = 5;

export interface ContentCopy {
  readonly content: unknown;
  /** When the CMS published it, as the copy says. */
  readonly publishedAt: string | undefined;
}

/** What a build shows, decided from what the CMS said and whether the site keeps a copy. */
export type ContentDecision =
  | { readonly source: "cms"; readonly content: unknown }
  | { readonly source: "initial" }
  /** The CMS cannot say what is published; the copy stands in. */
  | { readonly source: "copy"; readonly problem: Error }
  | { readonly source: "stop"; readonly problem: Error };

/**
 * A CMS that does not answer or fails falls back to the copy, and stops the build without one.
 * Every other refusal stops it, copy or not: a wrong address or token would otherwise go unnoticed.
 */
export function contentDecisionOf(
  answer: PublishedAnswer,
  hasCopy: boolean,
): ContentDecision {
  switch (answer.status) {
    case "published":
      return { source: "cms", content: answer.content };
    case "unknown-site":
      return { source: "initial" };
    case "unavailable":
      return hasCopy
        ? { source: "copy", problem: answer.problem }
        : { source: "stop", problem: answer.problem };
  }
}

/** Whether the build takes its content from the copy alone, by the value of `SEAMLET_CONTENT`. */
export function isCopyOnly(variable: string | undefined): boolean {
  if (variable === undefined || variable === "") return false;
  if (variable === COPY_ONLY) return true;
  throw new Error(
    `@seamlet/astro: ${CONTENT_SOURCE_VARIABLE} is "${variable}"; it is either unset or "${COPY_ONLY}"`,
  );
}

/** Reads the copy's text: it must be the content of this site, as the CMS wrote it. */
export function readContentCopy(text: string, siteId: string): ContentCopy {
  const copy = parsedCopy(text);
  if (!isJsonObject(copy)) throw copyError("is not an object");

  const { site, content, publishedAt } = copy;
  if (site !== siteId) {
    const named = typeof site === "string" ? `"${site}"` : "no site";
    throw copyError(`is the copy of ${named}, not of "${siteId}"`);
  }
  if (!isJsonObject(content)) throw copyError("has no `content` object");

  return {
    content,
    publishedAt: typeof publishedAt === "string" ? publishedAt : undefined,
  };
}

function parsedCopy(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw copyError("is not JSON", error);
  }
}

function copyError(reason: string, cause?: unknown): Error {
  return new Error(`@seamlet/astro: ${CONTENT_COPY_FILE} ${reason}`, {
    cause,
  });
}

/** When the copy was published, for a line of the build's log. */
export function publishedOn(copy: ContentCopy): string {
  return copy.publishedAt === undefined
    ? "at an unknown date"
    : `on ${copy.publishedAt}`;
}

/** The warning for a copy that does not fit the schema, or undefined when it does. */
export function copyIssuesWarning(
  issues: readonly ContentIssue[],
): string | undefined {
  if (issues.length === 0) return undefined;
  const named = issues
    .slice(0, MOST_ISSUES_NAMED)
    .map((issue) => `${formatFieldPath(issue.path)} (${issue.code})`);
  const rest = issues.length - named.length;
  const others = rest > 0 ? ` and ${String(rest)} more` : "";
  return `@seamlet/astro: ${CONTENT_COPY_FILE} does not fit the schema at ${named.join(", ")}${others}; those fields show what the schema falls back to`;
}
