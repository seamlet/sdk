// A page in the editor's frame stands still: the editor draws its outlines where the page last said
// its fields are, and the page is rendered anew after every edit, so rows that slide in, cards that
// fade up or a header that eases away would leave the outlines beside what they outline. Animations
// and transitions are not turned off but ended at once: an element that only shows up through its
// animation (from no opacity to full) is shown as it ends, and a site's code that waits for the end
// of an animation still hears it. Scrolling the editor asks for is not smoothed either.

const FROZEN_MOTION_RULES = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}

html, body {
  scroll-behavior: auto !important;
}
`;

/** Ends every animation and transition of the page at once; returns what lets them go again. */
export function freezeMotion(page: Document): () => void {
  return canAdoptStyleSheets(page)
    ? adoptFrozenMotion(page)
    : appendFrozenMotion(page);
}

/**
 * A stylesheet made by a script and adopted is not an inline style for a site's
 * Content-Security-Policy, so it applies under a policy that allows none.
 */
function canAdoptStyleSheets(page: Document): boolean {
  const view = page.defaultView;
  return (
    view !== null &&
    "adoptedStyleSheets" in page &&
    "replaceSync" in view.CSSStyleSheet.prototype
  );
}

function adoptFrozenMotion(page: Document): () => void {
  const view = page.defaultView;
  if (view === null) return () => undefined;

  const sheet = new view.CSSStyleSheet();
  sheet.replaceSync(FROZEN_MOTION_RULES);
  page.adoptedStyleSheets = [...page.adoptedStyleSheets, sheet];
  return () => {
    page.adoptedStyleSheets = page.adoptedStyleSheets.filter(
      (adopted) => adopted !== sheet,
    );
  };
}

function appendFrozenMotion(page: Document): () => void {
  const style = page.createElement("style");
  style.textContent = FROZEN_MOTION_RULES;
  page.head.append(style);
  return () => {
    style.remove();
  };
}
