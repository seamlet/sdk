import { FIELD_PATH_ATTRIBUTE, type FieldPath } from "../schema";
import { closestMarkedPath } from "./marked-paths";

// Finding the elements a site marked with the paths of its fields. Nodes are checked by their
// shape, not with instanceof: the classes are those of the bridge's window, and a page driven from
// another window (a test drives a frame) has classes of its own.

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

function asElement(value: unknown): Element | undefined {
  const isElement =
    typeof value === "object" &&
    value !== null &&
    "nodeType" in value &&
    value.nodeType === Node.ELEMENT_NODE;
  return isElement ? (value as Element) : undefined;
}
