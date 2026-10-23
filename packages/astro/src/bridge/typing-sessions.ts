import {
  makeEditable,
  makeUneditable,
  type EditableAs,
} from "./editable-elements";
import { listenToAll, onElement, type EventListening } from "./event-listening";
import type { InlineEditingOutcome } from "./messages";

// What every typing in an element of the page shares, a plain text or a formatted one: the element
// is editable while it lasts, Escape and the key that ends a text of one line end it and keep what
// was typed (the editor's undo takes it back, as in a word processor), and it ends once, giving the
// element back as it was.

export interface TypingSessionOptions {
  readonly editableAs: EditableAs;
  /** Whether the key ends the typing and keeps the text: Enter in a text of one line. */
  readonly isEndingKey: (event: KeyboardEvent) => boolean;
  /** What the typing hears while it lasts. */
  readonly listeners: readonly EventListening[];
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
    const isEnding = event.key === "Escape" || options.isEndingKey(event);
    if (!isEnding) return;

    event.preventDefault();
    end("kept");
  };
  let hasEnded = false;
  const end = (outcome: InlineEditingOutcome) => {
    if (hasEnded) return;
    hasEnded = true;
    stopListening();
    options.onStop();
    makeUneditable(element);
    options.onEnd(outcome);
  };

  makeEditable(element, options.editableAs);
  const stopListening = listenToAll([
    onElement(element, "keydown", endOnKey),
    ...options.listeners,
  ]);
  element.focus();
  return { end };
}
