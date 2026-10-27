import { FIELD_PATH_ATTRIBUTE, type FieldPath } from "../schema";
import { asElement } from "./dom-nodes";
import { rankedMarkersAt } from "./marker-picks";
import { closestMarkedPath } from "./marked-paths";
import { boxOf } from "./boxes";
import type { Point } from "./messages";
import { measureVisibleBoxes } from "./visible-boxes";

// Finding the elements a site marked with the paths of its fields.

const MARKER_SELECTOR = `[${FIELD_PATH_ATTRIBUTE}]`;
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

export interface MarkedElement {
  readonly element: HTMLElement;
  readonly path: string;
}

/** The marked element at or around the target of an event, with the path it is marked with. */
export function markedElementAround(
  target: EventTarget | null,
): MarkedElement | undefined {
  const element = asElement(target)?.closest(MARKER_SELECTOR);
  const path = element?.getAttribute(FIELD_PATH_ATTRIBUTE);
  const isMarked = isHtmlElement(element) && typeof path === "string";
  return isMarked ? { element, path } : undefined;
}

/**
 * The marked element a click at the point chooses, by the boxes of the marked elements around the
 * one it landed on (`rankedMarkersAt`): a price under a card's link stretched over the card is the
 * price. The element it landed on when no box holds the point.
 */
export function markedElementPickedAt(
  document: Document,
  landed: MarkedElement,
  point: Point,
): MarkedElement {
  const visibleBoxOf = measureVisibleBoxes(document);
  const placed = allMarkedElements(document).flatMap((marked) => {
    const shown = visibleBoxOf(marked.element);
    return shown === undefined ? [] : [{ ...marked, box: shown }];
  });
  const [picked] = rankedMarkersAt(placed, { path: landed.path, point });
  return picked === undefined
    ? landed
    : { element: picked.element, path: picked.path };
}

/**
 * Which copy of its field the marked element is: the page may show a field more than once (a
 * section's name on its tile and on a chip of a filter), and the editor outlines the one meant.
 * The copies are counted in the order of the page, from 0.
 */
export function copyOf(marked: MarkedElement): number {
  const document = marked.element.ownerDocument;
  const copy = shownCopiesOf(document, marked.path).indexOf(marked.element);
  return Math.max(copy, 0);
}

/**
 * The element of the field a typing goes into, when the page shows the field more than once: the
 * one a click made ready, else the copy at the point, else the copy named, else the first.
 */
export function copyToType(
  document: Document,
  path: string,
  near: {
    readonly prepared?: HTMLElement;
    readonly point?: Point;
    readonly copy?: number;
  },
): HTMLElement | undefined {
  const { prepared, point, copy } = near;
  const isPreparedCopy = prepared?.getAttribute(FIELD_PATH_ATTRIBUTE) === path;
  if (isPreparedCopy) return prepared;

  const atPoint =
    point === undefined
      ? undefined
      : shownCopiesOf(document, path).find((element) =>
          holdsPoint(element, point),
        );
  const named =
    copy === undefined ? undefined : markedCopyOf(document, path, copy);
  return atPoint ?? named ?? findMarkedElement(document, path);
}

/** The element of the path's copy, in the order of the page, among the copies that take space. */
export function markedCopyOf(
  document: Document,
  path: string,
  copy: number,
): HTMLElement | undefined {
  return shownCopiesOf(document, path)[copy];
}

/** The elements marked with the path that take space, in the order of the page, as reported. */
function shownCopiesOf(document: Document, path: string): HTMLElement[] {
  return allMarkedElements(document).flatMap((marked) => {
    const isShownCopy =
      marked.path === path && boxOf(marked.element) !== undefined;
    return isShownCopy ? [marked.element] : [];
  });
}

function holdsPoint(element: Element, point: Point): boolean {
  const box = boxOf(element);
  if (box === undefined) return false;

  const isAcross = point.x >= box.left && point.x <= box.left + box.width;
  const isAlong = point.y >= box.top && point.y <= box.top + box.height;
  return isAcross && isAlong;
}

export interface PageLink {
  readonly element: HTMLElement;
  /** The address as the site wrote it, not as the page's document resolves it. */
  readonly href: string;
}

/** The link at or around the target of an event. */
export function linkAround(target: EventTarget | null): PageLink | undefined {
  const element = asElement(target)?.closest("a[href]");
  const href = element?.getAttribute("href");
  const isLink = isHtmlElement(element) && typeof href === "string";
  return isLink ? { element, href } : undefined;
}

/** Whether the target of an event is inside a text being typed on the page. */
export function isInTypedText(target: EventTarget | null): boolean {
  const editable = asElement(target)?.closest("[contenteditable]");
  return editable !== null && editable !== undefined;
}

/** The first element marked with the path. */
export function findMarkedElement(
  document: Document,
  path: string,
): HTMLElement | undefined {
  const element = document.querySelector(
    `[${FIELD_PATH_ATTRIBUTE}="${CSS.escape(path)}"]`,
  );
  return isHtmlElement(element) ? element : undefined;
}

/** Every marked element of the page with its path, in the order of the page. */
export function allMarkedElements(
  document: Document,
): readonly MarkedElement[] {
  const elements = [...document.querySelectorAll(MARKER_SELECTOR)];
  return elements.flatMap((element) => {
    const marked = markedElementAround(element);
    return marked === undefined ? [] : [marked];
  });
}

export function hasMarkedDescendants(element: Element): boolean {
  return element.querySelector(MARKER_SELECTOR) !== null;
}

/** The element marked with the path or, when the site did not mark it, with the closest path around it. */
export function findClosestMarkedElement(
  document: Document,
  path: FieldPath,
): HTMLElement | undefined {
  const closestPath = closestMarkedPath(
    path,
    (marked) => findMarkedElement(document, marked) !== undefined,
  );
  return closestPath === undefined
    ? undefined
    : findMarkedElement(document, closestPath);
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return asElement(value)?.namespaceURI === HTML_NAMESPACE;
}
