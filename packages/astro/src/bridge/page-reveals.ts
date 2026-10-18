import { REVEAL_ATTRIBUTE, REVEAL_EVENT, REVEALED_ATTRIBUTE } from "../schema";

// What a page hides until a visitor acts, opened for the editor: a field can be edited only where
// it is seen. The bridge takes every click (a click selects, never acts), which would keep a native
// `<details>` closed and a tab made of radio buttons on its first tab, so a click on a summary
// opens it here and a click on a switch flips it. And the page is rendered anew after every edit,
// so what was opened is opened again in the new page.

const DETAILS_SELECTOR = "details";
const REVEAL_SELECTOR = `[${REVEAL_ATTRIBUTE}]`;
/** The switches a site shows and hides its parts by with CSS alone: tabs, filters, toggles. */
const SWITCH_SELECTOR = 'input[type="radio"], input[type="checkbox"]';

/** What is open on a page, by the order of such parts in it: the same parts in a page rendered anew. */
export interface RevealedParts {
  readonly openDetails: readonly number[];
  readonly revealed: readonly number[];
  /** The switches a person flipped away from how the page came. */
  readonly flippedSwitches: readonly number[];
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

/**
 * A click on a switch of the page, or on its label: a radio button is checked, and a checkbox is
 * flipped unless the click was on a field, which the person meant to choose.
 */
export function flipSwitchAt(
  target: EventTarget | null,
  isOnField: boolean,
): void {
  const control = switchAround(target);
  if (control === undefined) return;

  const isRadio = control.type === "radio";
  const isFlipped = isRadio ? !control.checked : !isOnField;
  if (!isFlipped) return;

  control.checked = isRadio || !control.checked;
  announceSwitch(control);
}

export function revealedPartsOf(document: Document): RevealedParts {
  const details = [...document.querySelectorAll(DETAILS_SELECTOR)];
  const parts = [...document.querySelectorAll(REVEAL_SELECTOR)];
  const switches = [...document.querySelectorAll(SWITCH_SELECTOR)];
  return {
    openDetails: indexesWhere(details, (part) => isDetails(part) && part.open),
    revealed: indexesWhere(parts, (part) =>
      part.hasAttribute(REVEALED_ATTRIBUTE),
    ),
    flippedSwitches: indexesWhere(
      switches,
      (control) =>
        isSwitch(control) && control.checked !== control.defaultChecked,
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
  // Last: a tab the person picked wins over a part revealed in it before.
  restoreSwitches(document, revealed.flippedSwitches);
}

function restoreSwitches(document: Document, flipped: readonly number[]): void {
  const switches = [...document.querySelectorAll(SWITCH_SELECTOR)];
  for (const index of flipped) {
    const control = switches[index];
    if (control === undefined || !isSwitch(control)) continue;
    control.checked = !control.defaultChecked;
    announceSwitch(control);
  }
}

/** Tells the site's scripts, which follow a switch by its events, as a visitor's click would. */
function announceSwitch(control: HTMLInputElement): void {
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function switchAround(
  target: EventTarget | null,
): HTMLInputElement | undefined {
  if (!isElement(target)) return undefined;

  const label = target.closest("label");
  const control = isLabel(label) ? label.control : target;
  return control !== null && isSwitch(control) ? control : undefined;
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

function isLabel(element: Element | null): element is HTMLLabelElement {
  return element?.localName === "label";
}

function isSwitch(element: Element): element is HTMLInputElement {
  return element.matches(SWITCH_SELECTOR);
}

function isElement(value: EventTarget | null): value is Element {
  return (
    value !== null &&
    "nodeType" in value &&
    (value as Node).nodeType === Node.ELEMENT_NODE
  );
}
