import { REVEAL_ATTRIBUTE, REVEAL_EVENT, REVEALED_ATTRIBUTE } from "../schema";

// What a page hides until a visitor acts, opened for the editor: a field can be edited only where
// it is seen. The bridge takes every click (a click selects, never acts), which would keep a native
// `<details>` closed, so a click on its summary opens it here. And the page is rendered anew after
// every edit, so what was opened is opened again in the new page.

const DETAILS_SELECTOR = "details";
const REVEAL_SELECTOR = `[${REVEAL_ATTRIBUTE}]`;

/** What is open on a page, by the order of such parts in it: the same parts in a page rendered anew. */
export interface RevealedParts {
  readonly openDetails: readonly number[];
  readonly revealed: readonly number[];
}

/** Opens everything around the element that keeps it hidden. */
export function revealAround(element: Element): void {
  for (let part: Element | null = element; part !== null;) {
    if (isDetails(part)) part.open = true;
    if (part.hasAttribute(REVEAL_ATTRIBUTE)) reveal(part);
    part = part.parentElement;
  }
}

/**
 * A click on the summary of a `<details>`: opens it when closed, and closes it when the click was
 * not on a field, which the person meant to choose.
 */
export function toggleDetailsAt(
  target: EventTarget | null,
  isOnField: boolean,
): void {
  const details = detailsOfSummaryAround(target);
  if (details === undefined) return;

  if (!details.open) {
    details.open = true;
    return;
  }
  if (!isOnField) details.open = false;
}

export function revealedPartsOf(document: Document): RevealedParts {
  const details = [...document.querySelectorAll(DETAILS_SELECTOR)];
  const parts = [...document.querySelectorAll(REVEAL_SELECTOR)];
  return {
    openDetails: indexesWhere(details, (part) => isDetails(part) && part.open),
    revealed: indexesWhere(parts, (part) =>
      part.hasAttribute(REVEALED_ATTRIBUTE),
    ),
  };
}

export function restoreRevealedParts(
  document: Document,
  revealed: RevealedParts,
): void {
  const details = [...document.querySelectorAll(DETAILS_SELECTOR)];
  const parts = [...document.querySelectorAll(REVEAL_SELECTOR)];
  for (const index of revealed.openDetails) {
    const part = details[index];
    if (part !== undefined && isDetails(part)) part.open = true;
  }
  for (const index of revealed.revealed) {
    const part = parts[index];
    if (part !== undefined) reveal(part);
  }
}

function reveal(part: Element): void {
  if (part.hasAttribute(REVEALED_ATTRIBUTE)) return;

  part.setAttribute(REVEALED_ATTRIBUTE, "");
  part.dispatchEvent(new CustomEvent(REVEAL_EVENT, { bubbles: true }));
}

function detailsOfSummaryAround(
  target: EventTarget | null,
): HTMLDetailsElement | undefined {
  const summary = isElement(target) ? target.closest("summary") : null;
  const details = summary?.parentElement;
  const isSummaryOfDetails =
    details !== null && details !== undefined && isDetails(details);
  return isSummaryOfDetails ? details : undefined;
}

function indexesWhere(
  elements: readonly Element[],
  isPicked: (element: Element) => boolean,
): readonly number[] {
  return elements.flatMap((element, index) =>
    isPicked(element) ? [index] : [],
  );
}

/** By its tag, not instanceof: a page driven from another window has classes of its own. */
function isDetails(element: Element): element is HTMLDetailsElement {
  return element.localName === "details";
}

function isElement(value: EventTarget | null): value is Element {
  return (
    value !== null &&
    "nodeType" in value &&
    (value as Node).nodeType === Node.ELEMENT_NODE
  );
}
