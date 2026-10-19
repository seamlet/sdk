import {
  listenToAll,
  onDocument,
  onElement,
  onWindow,
  type EventListening,
} from "./event-listening";
import { carriesFiles } from "./file-drags";
import {
  isInTypedText,
  linkAround,
  markedElementAround,
  type PageLink,
} from "./page-markers";
import { revealPartAt, togglePartAt } from "./page-reveals";

// What the bridge hears from the site's page. In the editor a click selects what it points at and
// does nothing else: links do not navigate and forms are not sent. A link that is not a field is
// reported, so the editor can open the page it leads to. The summary of a `<details>` still opens
// it, and a switch (a tab, a filter) still flips: what they hide holds fields too.

/**
 * How long after the last dragover a file drag counts as gone from the page. Browsers send
 * dragover all the time a drag is over the page, while dragleave says too little: Safari gives no
 * element it moved to, so leaving one element of the page looks like leaving the page.
 */
export const DRAG_GONE_AFTER_MS = 150;

export interface PagePointer {
  readonly element: HTMLElement;
  readonly path: string;
  /** Where the pointer was, in the coordinates of the page's viewport. */
  readonly point: { readonly x: number; readonly y: number };
}

export interface PageListeners {
  /** The pointer moved onto a marked element, or off all of them (undefined). */
  readonly onHover: (path: string | undefined) => void;
  /** A click on a marked element, or outside all of them (undefined). */
  readonly onClick: (pointer: PagePointer | undefined) => void;
  /** The pointer moved onto a link that is not a field, or off it (undefined). */
  readonly onLinkHover: (link: PageLink | undefined) => void;
  /** A click on a link that is not a field. */
  readonly onLinkClick: (link: PageLink) => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  /**
   * A file is dragged over a marked element, or over the rest of the page (undefined). Answers
   * whether the element takes the file, so the pointer shows it.
   */
  readonly onFileDragOver: (path: string | undefined) => boolean;
  /** The file dragged over the page left it, or was dropped outside a marked element. */
  readonly onFileDragEnd: () => void;
  readonly onFileDrop: (path: string, file: File) => void;
  /** The page scrolled, resized or loaded an image: what is drawn over it must move. */
  readonly onLayoutChange: () => void;
}

/** Listens to the page's document; the body may be replaced, the listeners stay. Returns a stop. */
export function listenToPage(
  document: Document,
  listeners: PageListeners,
): () => void {
  const fileDrags = followFileDrags(listeners);
  const { onLayoutChange } = listeners;
  const leave = () => {
    listeners.onHover(undefined);
    listeners.onLinkHover(undefined);
  };

  const stopListening = listenToAll([
    onDocument(document, "mouseover", (event) => {
      hover(event, listeners);
    }),
    onDocument(document, "click", (event) => {
      click(event, listeners);
    }),
    onDocument(document, "auxclick", preventDefault),
    onDocument(document, "submit", preventDefault),
    onDocument(document, "dragstart", preventDefault),
    onDocument(document, "keydown", listeners.onKeyDown),
    ...fileDrags.listenings(document),
    onDocument(document, "scroll", onLayoutChange),
    // An opened or closed `<details>` moves what is below it; toggle does not bubble.
    onDocument(document, "toggle", onLayoutChange),
    // A flipped switch shows and hides parts of the page.
    onDocument(document, "change", onLayoutChange),
    // Images load after the page is shown and move what is below them; load does not bubble.
    onDocument(document, "load", onLayoutChange),
    onElement(document.documentElement, "mouseleave", leave),
    ...onWindow(document.defaultView, "resize", onLayoutChange),
  ]);
  return () => {
    fileDrags.stop();
    stopListening();
  };
}

function hover(event: MouseEvent, listeners: PageListeners): void {
  const link = linkToFollow(event.target);
  const path =
    link === undefined ? markedElementAround(event.target)?.path : undefined;
  listeners.onHover(path);
  listeners.onLinkHover(link);
}

/** A click selects what it points at: a link it follows, a field it chooses. */
function click(event: MouseEvent, listeners: PageListeners): void {
  event.preventDefault();
  const link = linkToFollow(event.target);
  if (link !== undefined) {
    listeners.onLinkClick(link);
    return;
  }

  const marked = markedElementAround(event.target);
  if (marked === undefined) {
    togglePartAt(event.target);
    listeners.onClick(undefined);
    return;
  }

  revealPartAt(event.target);
  const point = { x: event.clientX, y: event.clientY };
  listeners.onClick({ ...marked, point });
}

function preventDefault(event: Event): void {
  event.preventDefault();
}

/**
 * Follows a file dragged over the page. A file dropped where nothing takes it would open in place
 * of the page, so the browser's own drop is always stopped.
 */
function followFileDrags(listeners: PageListeners): {
  readonly listenings: (document: Document) => readonly EventListening[];
  readonly stop: () => void;
} {
  let dragGoneTimer: ReturnType<typeof setTimeout> | undefined;
  const dragFile = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    clearTimeout(dragGoneTimer);
    const path = markedElementAround(event.target)?.path;
    const isTaken = listeners.onFileDragOver(path);
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = isTaken ? "copy" : "none";
    }
  };
  const dropFile = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    clearTimeout(dragGoneTimer);
    listeners.onFileDragEnd();
    const path = markedElementAround(event.target)?.path;
    const file = event.dataTransfer?.files[0];
    if (path !== undefined && file !== undefined)
      listeners.onFileDrop(path, file);
  };
  const leaveWithFile = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    clearTimeout(dragGoneTimer);
    dragGoneTimer = setTimeout(listeners.onFileDragEnd, DRAG_GONE_AFTER_MS);
  };

  return {
    listenings: (document) => [
      onDocument(document, "dragover", dragFile),
      onDocument(document, "drop", dropFile),
      onDocument(document, "dragleave", leaveWithFile),
    ],
    stop: () => {
      clearTimeout(dragGoneTimer);
    },
  };
}

/** A link that opens where it leads; a link inside a text being typed is a part of the text. */
function linkToFollow(target: EventTarget | null): PageLink | undefined {
  return isInTypedText(target) ? undefined : nearerLink(target);
}

/**
 * The link at the target when it is nearer than the closest field: a link inside a marked group
 * or record (a button «Всё меню» in a marked first screen) is a link, a link that is itself a
 * field (a phone number) is the field.
 */
function nearerLink(target: EventTarget | null): PageLink | undefined {
  const link = linkAround(target);
  const marked = markedElementAround(target);
  const isFieldInsideLink =
    marked !== undefined &&
    link !== undefined &&
    !marked.element.contains(link.element);
  const isLinkTheField =
    marked !== undefined && marked.element === link?.element;
  return isFieldInsideLink || isLinkTheField ? undefined : link;
}
