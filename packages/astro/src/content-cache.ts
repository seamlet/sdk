// The published content kept for a short while: a crawler reads the sitemap and llms.txt now and
// then, but may read many at once, and each would otherwise make the CMS answer anew.

/** How long loaded content is used before the CMS is asked again: a publication shows within it. */
export const FRESH_FOR_MS = 30_000;

export interface ContentCache<Content> {
  /** The content loaded at most `freshForMs` before `now`, or loaded now; loads at once share one. */
  readonly contentAt: (now: number) => Promise<Content>;
}

export function createContentCache<Content>(
  load: () => Promise<Content>,
  freshForMs: number,
): ContentCache<Content> {
  let kept:
    { readonly content: Content; readonly loadedAt: number } | undefined;
  let loading: Promise<Content> | undefined;

  const loadOnce = (now: number): Promise<Content> => {
    loading ??= load()
      .then((content) => {
        kept = { content, loadedAt: now };
        return content;
      })
      .finally(() => {
        loading = undefined;
      });
    return loading;
  };

  return {
    contentAt: (now) => {
      if (kept !== undefined && now - kept.loadedAt < freshForMs) {
        return Promise.resolve(kept.content);
      }
      return loadOnce(now);
    },
  };
}
