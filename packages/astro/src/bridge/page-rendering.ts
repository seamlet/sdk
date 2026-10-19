import type { Content } from "../schema";
import { restoreRevealedParts, revealedPartsOf } from "./page-reveals";

// The site's page shows the editor's draft: the bridge posts the draft to the page's own address,
// where the site renders the page with it, and swaps the body. The document stays, so do its
// styles, its scroll position and the bridge's listeners.

export interface PageRendererOptions {
  readonly document: Document;
  /** Whether a rendered page may replace the current one now (not while a text is typed in it). */
  readonly canReplacePage: () => boolean;
  /**
   * Whether a person presses on the page now. A page replaced between the press and the release
   * would lose the click (the two land on different elements), so it waits for the release.
   */
  readonly isPagePressed: () => boolean;
  readonly onRendered: () => void;
  readonly onFailed: (error: unknown) => void;
}

export interface PageRenderer {
  readonly render: (content: Content) => void;
  /**
   * Shows the latest rendered page held back by a press or by typing, if the page may be replaced
   * now: call it when the press or the typing is over.
   */
  readonly showHeldPage: () => void;
  readonly stop: () => void;
}

/**
 * Only the latest render counts: a new one cancels the request of the previous one, and a page
 * that may not be replaced yet is held until it may, unless a newer render comes first.
 */
export function createPageRenderer(options: PageRendererOptions): PageRenderer {
  let request: AbortController | undefined;
  let heldPage: string | undefined;

  const show = (html: string) => {
    const isPageBusy = options.isPagePressed() || !options.canReplacePage();
    if (isPageBusy) {
      heldPage = html;
      return;
    }

    replacePageBody(options.document, html);
    options.onRendered();
  };

  const render = (content: Content) => {
    request?.abort();
    heldPage = undefined;
    const currentRequest = new AbortController();
    request = currentRequest;
    fetchRenderedPage(
      pageAddress(options.document),
      content,
      currentRequest.signal,
    )
      .then(show)
      .catch((error: unknown) => {
        if (currentRequest.signal.aborted) return;
        options.onFailed(error);
      });
  };

  const showHeldPage = () => {
    const html = heldPage;
    heldPage = undefined;
    if (html !== undefined) show(html);
  };

  return {
    render,
    showHeldPage,
    stop: () => {
      request?.abort();
      heldPage = undefined;
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
