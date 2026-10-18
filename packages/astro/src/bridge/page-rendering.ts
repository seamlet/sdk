import type { Content } from "../schema";
import { restoreRevealedParts, revealedPartsOf } from "./page-reveals";

// The site's page shows the editor's draft: the bridge posts the draft to the page's own address,
// where the site renders the page with it, and swaps the body. The document stays, so do its
// styles, its scroll position and the bridge's listeners.

export interface PageRendererOptions {
  readonly document: Document;
  /** Whether a rendered page may replace the current one now (not while a text is typed in it). */
  readonly canReplacePage: () => boolean;
  readonly onRendered: () => void;
  readonly onFailed: (error: unknown) => void;
}

export interface PageRenderer {
  readonly render: (content: Content) => void;
  readonly stop: () => void;
}

/** Only the latest render counts: a new one cancels the request of the previous one. */
export function createPageRenderer(options: PageRendererOptions): PageRenderer {
  let request: AbortController | undefined;

  const render = (content: Content) => {
    request?.abort();
    const currentRequest = new AbortController();
    request = currentRequest;
    fetchRenderedPage(
      pageAddress(options.document),
      content,
      currentRequest.signal,
    )
      .then((html) => {
        if (!options.canReplacePage()) return;
        replacePageBody(options.document, html);
        options.onRendered();
      })
      .catch((error: unknown) => {
        if (currentRequest.signal.aborted) return;
        options.onFailed(error);
      });
  };

  return {
    render,
    stop: () => {
      request?.abort();
    },
  };
}

/** The page's own address without its fragment: where the site renders the page. */
function pageAddress(document: Document): string {
  const url = new URL(document.URL);
  url.hash = "";
  return url.href;
}

async function fetchRenderedPage(
  url: string,
  content: Content,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
    signal,
  });
  // A redirect would lead to another page: never put it in place of this one.
  if (!response.ok || response.redirected) {
    throw new Error(
      `Rendering the draft at ${url} failed with status ${String(response.status)}`,
    );
  }
  return response.text();
}

/**
 * Replaces the body and the title of the page with those of a newly rendered one, with the parts
 * that were opened for the editor opened again.
 */
export function replacePageBody(document: Document, html: string): void {
  const rendered = new DOMParser().parseFromString(html, "text/html");
  const revealed = revealedPartsOf(document);
  document.title = rendered.title;
  document.body.replaceWith(document.importNode(rendered.body, true));
  restoreRevealedParts(document, revealed);
}
