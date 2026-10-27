import { FIELD_PATH_SEPARATOR } from "../schema";
import type { Box } from "./boxes";
import {
  coveredFieldsOf,
  isShownIn,
  type CoveredField,
} from "./covered-fields";
import { asElement } from "./dom-nodes";
import { listenToAll, onWindow } from "./event-listening";
import {
  allMarkedElements,
  markedElementAround,
  markedElementPickedAt,
} from "./page-markers";
import {
  describeUnmarkedText,
  unmarkedTextsOf,
  type PageNode,
} from "./unmarked-texts";
import type { Point } from "./messages";
import { measureVisibleBoxes } from "./visible-boxes";

// What the preview tells a site's author in the console of the editor's frame: the texts of the
// page the editor cannot reach, once, and the fields another element covers, each once, as they
// come into view. The editor itself is told nothing: these are the site's to fix.

/** How long the page stays still before the fields in view are tried: scrolling has settled. */
const SETTLE_MS = 1000;
const WARNING_PREFIX = "@seamlet/astro:";
/** A place of a record in a path, folded so the records of a collection are named once. */
const RECORD_INDEX = /^\d+$/u;
const ANY_RECORD = "*";

interface PlacedElement {
  readonly path: string;
  readonly box: Box;
  readonly element: HTMLElement;
}

/** Warns about what the editor cannot reach on the page; returns what stops the checks. */
export function warnAboutUnreachableFields(document: Document): () => void {
  const view = document.defaultView;
  const settled = new WeakSet<Element>();
  let timer: number | undefined;

  const checkCoveredFields = () => {
    timer = undefined;
    warnAboutCoveredFields(document, settled);
  };
  const scheduleCheck = () => {
    if (timer !== undefined) view?.clearTimeout(timer);
    timer = view?.setTimeout(checkCoveredFields, SETTLE_MS);
  };

  warnAboutUnmarkedTexts(document);
  scheduleCheck();
  const stopListening = listenToAll([
    ...onWindow(view, "scroll", scheduleCheck),
    ...onWindow(view, "resize", scheduleCheck),
  ]);
  return () => {
    if (timer !== undefined) view?.clearTimeout(timer);
    stopListening();
  };
}

function warnAboutUnmarkedTexts(document: Document): void {
  const page = pageNodeOf(document.body);
  if (page === undefined) return;

  const unmarked = unmarkedTextsOf(page);
  if (unmarked.length === 0) return;

  const lines = unmarked.map((text) => `  ${describeUnmarkedText(text)}`);
  console.warn(
    [
      `${WARNING_PREFIX} ${String(unmarked.length)} texts of this page have no field, so the editor cannot edit them. Mark each with editable() of its field, or with data-cms-fixed when the code owns it:`,
      ...lines,
    ].join("\n"),
  );
}

/** Tries the fields in view not tried yet, and warns about the ones covered. */
function warnAboutCoveredFields(
  document: Document,
  settled: WeakSet<Element>,
): void {
  const root = document.documentElement;
  const viewport = { width: root.clientWidth, height: root.clientHeight };
  const inView = placedElementsOf(document).filter(
    ({ element, box }) => !settled.has(element) && isShownIn(box, viewport),
  );
  if (inView.length === 0) return;

  const covered = coveredFieldsOf(inView, {
    viewport,
    isFieldAt: (field, point) =>
      field.element.contains(elementClickedAt(document, point)),
    whatIsAt: (point) =>
      describeHit(document.elementFromPoint(point.x, point.y)),
  });
  for (const { element } of inView) settled.add(element);
  if (covered.length === 0) return;

  const lines = foldedByRecords(covered).map(
    ({ path, coveredBy }) => `  ${path} is under ${coveredBy}`,
  );
  console.warn(
    [
      `${WARNING_PREFIX} a click on these fields lands on another element, so the editor cannot choose them on the page. Keep what lies over them from taking the click in the preview (pointer-events: none):`,
      ...lines,
    ].join("\n"),
  );
}

/**
 * The marked elements by the part of each a person sees: a field scrolled under a sticky header is
 * not in view yet, and is checked once it comes out.
 */
function placedElementsOf(document: Document): PlacedElement[] {
  const visibleBoxOf = measureVisibleBoxes(document);
  return allMarkedElements(document).flatMap(({ element, path }) => {
    const box = visibleBoxOf(element);
    return box === undefined ? [] : [{ path, box, element }];
  });
}

/**
 * What a click at the point chooses, by the rule a click on the page follows: the smallest marked
 * element at the point in the block of the one it landed on, so a price under its card's stretched
 * link is chosen; the element on top when it lands on no marked element.
 */
function elementClickedAt(document: Document, point: Point): Element | null {
  const hit = document.elementFromPoint(point.x, point.y);
  const landed = markedElementAround(hit);
  if (landed === undefined) return hit;

  return markedElementPickedAt(document, landed, point).element;
}

/** `the field menu.0.name (a.card-link)`, or the element alone when it holds no field. */
function describeHit(hit: Element | null): string {
  if (hit === null) return "nothing";

  const element = describeElement(hit);
  const marked = markedElementAround(hit);
  return marked === undefined
    ? element
    : `the field ${marked.path} (${element})`;
}

function describeElement(element: Element): string {
  const [ownClass] = [...element.classList].filter(
    (name) => !name.startsWith("astro-"),
  );
  const name = element.localName;
  return ownClass === undefined ? name : `${name}.${ownClass}`;
}

/** The covered fields with the records of a collection folded: `menu.*.price` once. */
function foldedByRecords(covered: readonly CoveredField[]): CoveredField[] {
  const folded = new Map<string, CoveredField>();
  for (const { path, coveredBy } of covered) {
    const foldedPath = foldRecords(path);
    const foldedCover = foldRecords(coveredBy);
    folded.set(`${foldedPath}\n${foldedCover}`, {
      path: foldedPath,
      coveredBy: foldedCover,
    });
  }
  return [...folded.values()];
}

function foldRecords(path: string): string {
  return path
    .split(FIELD_PATH_SEPARATOR)
    .map((name) => (RECORD_INDEX.test(name) ? ANY_RECORD : name))
    .join(FIELD_PATH_SEPARATOR);
}

/**
 * The page as the check of texts reads it, without what the browser does not show: an element
 * with no box (`display: none`, a closed `<details>`) or hidden by `visibility`.
 */
export function pageNodeOf(node: Node): PageNode | undefined {
  if (node.nodeType === Node.TEXT_NODE) {
    return { kind: "text", text: node.nodeValue ?? "" };
  }
  const element = asElement(node);
  if (element === undefined || !isShown(element)) return undefined;

  const attributes = Object.fromEntries(
    [...element.attributes].map(({ name, value }) => [name, value]),
  );
  const children = [...element.childNodes].flatMap((child) => {
    const read = pageNodeOf(child);
    return read === undefined ? [] : [read];
  });
  return { kind: "element", name: element.localName, attributes, children };
}

function isShown(element: Element): boolean {
  // A browser without the check (and jsdom) shows every element; `display: contents` has no box of
  // its own, yet its children are shown.
  const canCheck = "checkVisibility" in element;
  if (!canCheck) return true;
  const view = element.ownerDocument.defaultView;
  const isContents = view?.getComputedStyle(element).display === "contents";
  return isContents || element.checkVisibility({ visibilityProperty: true });
}
