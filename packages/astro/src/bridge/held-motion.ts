import { HELD_ATTRIBUTE, POPOVER_ATTRIBUTE } from "../schema";
import { asElement } from "./dom-nodes";
import {
  listenToAll,
  onDocument,
  onPageClick,
  onElement,
  type EventListening,
} from "./event-listening";
import { findMarkedElement, markedElementAround } from "./page-markers";

// The parts of a page a site marked as moving hold still in the editor while the pointer is over
// them, so they can be clicked, and once a field in them is chosen, so the outline the editor draws
// around it stays on it while it is edited. The page is rendered anew after every edit, so the
// chosen part is found again by the path of its field.

const POPOVER_SELECTOR = `[${POPOVER_ATTRIBUTE}]`;

/** Whether the element moves, or stands in a part that does: its field is edited in the popover. */
export function isEditedInPopover(element: Element): boolean {
  return element.closest(POPOVER_SELECTOR) !== null;
}

export interface MotionHolds {
  /** Holds the chosen part again in a page rendered anew. */
  readonly holdAgain: () => void;
  readonly stop: () => void;
}

/** Follows the pointer and the clicks on the page and holds the moving parts they are on. */
export function holdMotionOnPage(document: Document): MotionHolds {
  const paused = new Map<Element, readonly Animation[]>();
  let hovered: Element | undefined;
  let chosenPath: string | undefined;

  const chosenPart = () => {
    if (chosenPath === undefined) return undefined;
    const element = findMarkedElement(document, chosenPath);
    return element?.closest(POPOVER_SELECTOR) ?? undefined;
  };
  const update = () => {
    const parts = new Set([hovered, chosenPart()]);
    for (const part of [...paused.keys()]) {
      if (!parts.has(part)) release(part, paused);
    }
    for (const part of parts) {
      if (part !== undefined && !paused.has(part)) hold(part, paused);
    }
  };

  const stopListening = listenToAll(
    listeningsOf(document, {
      onPointerOver: (target) => {
        hovered = partAround(target);
        update();
      },
      onPointerLeave: () => {
        hovered = undefined;
        update();
      },
      onClick: (target) => {
        const marked = markedElementAround(target);
        const isMoving =
          marked !== undefined && isEditedInPopover(marked.element);
        chosenPath = isMoving ? marked.path : undefined;
        update();
      },
    }),
  );

  return {
    holdAgain: update,
    stop: () => {
      stopListening();
      for (const part of [...paused.keys()]) release(part, paused);
    },
  };
}

interface PointerListeners {
  readonly onPointerOver: (target: EventTarget | null) => void;
  readonly onPointerLeave: () => void;
  readonly onClick: (target: EventTarget | null) => void;
}

function listeningsOf(
  document: Document,
  listeners: PointerListeners,
): readonly EventListening[] {
  return [
    onDocument(document, "mouseover", (event) => {
      listeners.onPointerOver(event.target);
    }),
    onPageClick(document, (event) => {
      listeners.onClick(event.target);
    }),
    onElement(document.documentElement, "mouseleave", listeners.onPointerLeave),
  ];
}

function partAround(target: EventTarget | null): Element | undefined {
  return asElement(target)?.closest(POPOVER_SELECTOR) ?? undefined;
}

function hold(part: Element, paused: Map<Element, readonly Animation[]>): void {
  const running = animationsOf(part).filter(
    (animation) => animation.playState === "running",
  );
  for (const animation of running) animation.pause();
  part.setAttribute(HELD_ATTRIBUTE, "");
  paused.set(part, running);
}

function release(
  part: Element,
  paused: Map<Element, readonly Animation[]>,
): void {
  for (const animation of paused.get(part) ?? []) animation.play();
  part.removeAttribute(HELD_ATTRIBUTE);
  paused.delete(part);
}

/** The CSS animations and transitions of the part and of everything in it. */
function animationsOf(part: Element): readonly Animation[] {
  // Browsers without the Web Animations API (and jsdom) leave the motion to the site.
  if (typeof part.getAnimations !== "function") return [];
  return part.getAnimations({ subtree: true });
}
