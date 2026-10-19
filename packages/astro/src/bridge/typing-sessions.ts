import {
  makeEditable,
  makeUneditable,
  type EditableAs,
} from "./editable-elements";
import type { InlineEditingOutcome } from "./messages";

// What every typing in an element of the page shares, a plain text or a formatted one: the element
// is editable while it lasts, Escape brings the text back, the key that ends a text of one line
// keeps it, and it ends once, giving the element back as it was.

/** A listener the typing holds while it lasts. */
export interface TypingListener {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListener;
  /** Heard on the way down, before the page's own listeners. */
  readonly isCapturing?: boolean;
}

export interface TypingSessionOptions {
  readonly editableAs: EditableAs;
  /** Whether the key ends the typing and keeps the text: Enter in a text of one line. */
  readonly isEndingKey: (event: KeyboardEvent) => boolean;
  readonly listeners: readonly TypingListener[];
  /** What the typing stops besides its listeners, when it ends. */
  readonly onStop: () => void;
  readonly onEnd: (outcome: InlineEditingOutcome) => void;
}

export interface TypingSession {
  /** Ends the typing, once: later calls do nothing. */
  readonly end: (outcome: InlineEditingOutcome) => void;
}

/** Makes the element editable and focused until the typing ends. */
export function startTypingSession(
  element: HTMLElement,
  options: TypingSessionOptions,
): TypingSession {
  const endOnKey = (event: KeyboardEvent) => {
    const outcome = outcomeOfKey(event, options.isEndingKey);
    if (outcome === undefined) return;

    event.preventDefault();
    end(outcome);
  };
  const listeners: readonly TypingListener[] = [
    elementListener(element, "keydown", endOnKey),
    ...options.listeners,
  ];

  let hasEnded = false;
  const end = (outcome: InlineEditingOutcome) => {
    if (hasEnded) return;
    hasEnded = true;
    for (const { target, type, listener, isCapturing } of listeners) {
      target.removeEventListener(type, listener, isCapturing);
    }
    options.onStop();
    makeUneditable(element);
    options.onEnd(outcome);
  };

  makeEditable(element, options.editableAs);
  for (const { target, type, listener, isCapturing } of listeners) {
    target.addEventListener(type, listener, isCapturing);
  }
  element.focus();
  return { end };
}

/** A listener of an event of the element, with the event's own type. */
export function elementListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
): TypingListener {
  // The element sends the event of the type K only: the listener gets the event it expects.
  return { target: element, type, listener: listener as EventListener };
}

function outcomeOfKey(
  event: KeyboardEvent,
  isEndingKey: (event: KeyboardEvent) => boolean,
): InlineEditingOutcome | undefined {
  if (event.key === "Escape") return "reverted";
  return isEndingKey(event) ? "kept" : undefined;
}
