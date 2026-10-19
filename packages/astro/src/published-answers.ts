// How a site's build reads the CMS's answer to `/api/sites/<id>/published`. A site the CMS does not
// know yet is not an error: a site connected from its repository is built before the CMS knows it,
// and until then it has published nothing, so it shows its initial content. Any other refusal stops
// the build, as a wrong address of the CMS would otherwise go unnoticed.

const NOT_FOUND = 404;
/** A build waits this long for the CMS; a CMS that does not answer stops it instead of hanging it. */
export const PUBLISHED_CONTENT_TIMEOUT_MS = 30_000;
/** What the CMS answers for a site it has not connected. */
const UNKNOWN_SITE = "unknown-site";

export type PublishedAnswer =
  | { readonly status: "published"; readonly content: unknown }
  | { readonly status: "unknown-site" };

/** Asks the CMS at the address what it published for the site. */
export async function fetchPublishedAnswer(url: URL): Promise<PublishedAnswer> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(PUBLISHED_CONTENT_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `Loading the published content from ${url.href} failed: the CMS did not answer`,
      { cause: error },
    );
  }
  return readPublishedAnswer(response, url);
}

export async function readPublishedAnswer(
  response: Response,
  url: URL,
): Promise<PublishedAnswer> {
  if (response.ok)
    return { status: "published", content: await response.json() };

  const isUnknownSite =
    response.status === NOT_FOUND && (await errorOf(response)) === UNKNOWN_SITE;
  if (isUnknownSite) return { status: "unknown-site" };
  throw new Error(
    `Loading the published content from ${url.href} failed with status ${String(response.status)}`,
  );
}

/** The `error` of a JSON body, or undefined for any other body. */
async function errorOf(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null
      ? (body as { error?: unknown }).error
      : undefined;
  } catch {
    // Not JSON: not the CMS's answer about a site.
    return undefined;
  }
}
