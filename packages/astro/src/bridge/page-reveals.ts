import {
  FIELD_PATH_ATTRIBUTE,
  REVEAL_ATTRIBUTE,
  REVEAL_EVENT,
  REVEALED_ATTRIBUTE,
} from "../schema";
import { asElement } from "./dom-nodes";

// What a page hides until a visitor acts, opened for the editor: a field can be edited only where
// it is seen. The bridge takes every click (a click selects, never acts), which would keep a native
// `<details>` closed and a tab made of radio buttons on its first tab, so a click on a summary
// opens it here and a click on a switch flips it. And the page is rendered anew after every edit,
// so what was opened is opened again in the new page.

const DETAILS_SELECTOR = "details";
const REVEAL_SELECTOR = `[${REVEAL_ATTRIBUTE}]`;
/** The switches a site shows and hides its parts by with CSS alone: tabs, filters, toggles. */
const SWITCH_SELECTOR = 'input[type="radio"], input[type="checkbox"]';
const MARKER_SELECTOR = `[${FIELD_PATH_ATTRIBUTE}]`;
const KEY_SEPARATOR = "\n";

/**
 * What is open on a page, each part by its key (see partKeysOf): the same parts in a page rendered
 * anew, even when the draft added a part before them.
 */
export interface RevealedParts {
  readonly openDetails: readonly string[];
  readonly revealed: readonly string[];
  /** The switches a person flipped away from how the page came. */
  readonly flippedSwitches: readonly string[];
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
 * A click on a field inside the summary of a `<details>` or the label of a switch: a closed
 * `<details>` opens and a radio button is checked, while nothing the person meant to choose the
 * field in is closed or unchecked.
 */
export function revealPartAt(target: EventTarget | null): void {
  const details = detailsOfSummaryAround(target);
  if (details !== undefined) details.open = true;

  const control = switchAround(target);
  const isUncheckedRadio = control?.type === "radio" && !control.checked;
  if (control !== undefined && isUncheckedRadio) checkSwitch(control, true);
}

/**
 * A click on the summary of a `<details>` or on a switch (or its label), off the fields: the
 * `<details>` opens or closes, a radio button is checked and a checkbox flipped.
 */
export function togglePartAt(target: EventTarget | null): void {
  const details = detailsOfSummaryAround(target);
  if (details !== undefined) details.open = !details.open;

  const control = switchAround(target);
  if (control === undefined) return;
  const isRadio = control.type === "radio";
  if (isRadio && control.checked) return;
  checkSwitch(control, isRadio || !control.checked);
}

export function revealedPartsOf(document: Document): RevealedParts {
  const details = [...document.querySelectorAll(DETAILS_SELECTOR)];
  const parts = [...document.querySelectorAll(REVEAL_SELECTOR)];
  const switches = [...document.querySelectorAll(SWITCH_SELECTOR)];
  return {
    openDetails: keysWhere(details, (part) => isDetails(part) && part.open),
    revealed: keysWhere(parts, (part) => part.hasAttribute(REVEALED_ATTRIBUTE)),
    flippedSwitches: keysWhere(
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
  const details = partsWithKeys(
    document,
    DETAILS_SELECTOR,
    revealed.openDetails,
  );
  const parts = partsWithKeys(document, REVEAL_SELECTOR, revealed.revealed);
  for (const part of details) {
    if (isDetails(part)) part.open = true;
  }
  for (const part of parts) reveal(part);
  // Last: a tab the person picked wins over a part revealed in it before.
  const switches = partsWithKeys(
    document,
    SWITCH_SELECTOR,
    revealed.flippedSwitches,
  );
  for (const control of switches) {
    if (isSwitch(control)) flipFromDefault(control);
  }
}

function flipFromDefault(control: HTMLInputElement): void {
  checkSwitch(control, !control.defaultChecked);
}

function checkSwitch(control: HTMLInputElement, isChecked: boolean): void {
  control.checked = isChecked;
  announceSwitch(control);
}

/** The parts of the page the selector finds whose keys are among the given ones. */
function partsWithKeys(
  document: Document,
  selector: string,
  keys: readonly string[],
): readonly Element[] {
  const wanted = new Set(keys);
  const parts = [...document.querySelectorAll(selector)];
  const partKeys = partKeysOf(parts);
  return parts.filter((_, index) => wanted.has(partKeys[index] ?? ""));
}

/** Tells the site's scripts, which follow a switch by its events, as a visitor's click would. */
function announceSwitch(control: HTMLInputElement): void {
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function switchAround(
  target: EventTarget | null,
): HTMLInputElement | undefined {
  const element = asElement(target);
  if (element === undefined) return undefined;

  const label = element.closest("label");
  const control = isLabel(label) ? label.control : element;
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
  const summary = asElement(target)?.closest("summary");
  const details = summary?.parentElement;
  const isSummaryOfDetails =
    details !== null && details !== undefined && isDetails(details);
  return isSummaryOfDetails ? details : undefined;
}

function keysWhere(
  elements: readonly Element[],
  isPicked: (element: Element) => boolean,
): readonly string[] {
  const keys = partKeysOf(elements);
  return elements.flatMap((element, index) =>
    isPicked(element) ? [keys[index] ?? ""] : [],
  );
}

/**
 * What names each part in a page rendered anew: its id, or else the field marked on it, in it or
 * around it, with its place among the parts named the same. A part added before it with other
 * fields leaves it its key, where its place in the whole page would change.
 */
function partKeysOf(parts: readonly Element[]): readonly string[] {
  const names = parts.map(partNameOf);
  return names.map((name, index) => {
    const place = names.slice(0, index).filter((each) => each === name).length;
    return `${name}${KEY_SEPARATOR}${String(place)}`;
  });
}

function partNameOf(part: Element): string {
  if (part.id !== "") return `#${part.id}`;

  const marked =
    part.closest(MARKER_SELECTOR) ?? part.querySelector(MARKER_SELECTOR);
  return marked?.getAttribute(FIELD_PATH_ATTRIBUTE) ?? "";
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
