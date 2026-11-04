import { EDITABLE_AS_PLAIN_TEXT } from "./editable-elements";
import { readElementText } from "./element-text";
import type { InlineEditingOutcome } from "./messages";
import { onElement, type EventListening } from "./event-listening";
import { startTypingSession } from "./typing-sessions";

// Editing a text right in the element of the site's page that shows it. The element becomes
// editable as plain text, so the site's markup inside it is never changed by formatting.

export interface InlineTextEditingOptions {
  /** A single-line field ends its editing on Enter instead of taking a line break. */
  readonly isSingleLine: boolean;
  /** The characters a person may type or paste (a number's digits); any, without it. */
  readonly acceptedCharacters?: RegExp;
  /** A character was refused: said once for a run of refused ones, and again after one that went in. */
  readonly onRefused?: () => void;
  readonly onInput: (text: string) => void;
  readonly onEnd: (outcome: InlineEditingOutcome) => void;
}

/** Makes the element editable until Enter (single line), Escape or a click elsewhere; returns a stop. */
export function startInlineTextEditing(
  element: HTMLElement,
  options: InlineTextEditingOptions,
): () => void {
  const reportInput = () => {
    options.onInput(readElementText(element));
  };
  const endOnBlur = () => {
    session.end("kept");
  };

  const session = startTypingSession(element, {
    editableAs: EDITABLE_AS_PLAIN_TEXT,
    isEndingKey: (event) => event.key === "Enter" && options.isSingleLine,
    listeners: [
      onElement(element, "input", reportInput),
      onElement(element, "blur", endOnBlur),
      ...characterChecks(element, options),
    ],
    onStop: () => undefined,
    onEnd: options.onEnd,
  });
  return () => {
    session.end("kept");
  };
}

/** Refuses typed and pasted words with a character the field does not take; nothing without a rule. */
function characterChecks(
  element: HTMLElement,
  options: InlineTextEditingOptions,
): readonly EventListening[] {
  const accepted = options.acceptedCharacters;
  if (accepted === undefined) return [];

  let isInRefusedRun = false;
  const refuseOthers = (event: InputEvent) => {
    // A deletion or a line break inserts no words.
    const inserted = event.data ?? event.dataTransfer?.getData("text/plain");
    if (inserted === undefined) return;

    const isRefused = !accepted.test(inserted);
    if (isRefused) event.preventDefault();
    if (isRefused && !isInRefusedRun) options.onRefused?.();
    isInRefusedRun = isRefused;
  };
  return [onElement(element, "beforeinput", refuseOthers)];
}

/**
 * Puts the caret where a person clicked, as a click into an editable text would; after the text
 * when there was no click (the editor moved to the field with Tab).
 */
export function placeCaretAt(
  element: HTMLElement,
  point: { readonly x: number; readonly y: number } | undefined,
): void {
  const document = element.ownerDocument;
  const selection = document.getSelection();
  const range =
    point === undefined
      ? document.createRange()
      : caretRangeAt(document, point);
  if (selection === null || range === undefined) {
    return;
  }

  const isInside = element.contains(range.startContainer);
  if (!isInside) {
    range.selectNodeContents(element);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

// caretPositionFromPoint is the standard; Safari before 26 has only caretRangeFromPoint.
interface CaretLookup {
  readonly caretPositionFromPoint?: (
    x: number,
    y: number,
  ) => CaretPosition | null;
  readonly caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

function caretRangeAt(
  document: Document,
  point: { readonly x: number; readonly y: number },
): Range | undefined {
  const lookup: CaretLookup = document;
  if (lookup.caretPositionFromPoint !== undefined) {
    const position = lookup.caretPositionFromPoint(point.x, point.y);
    if (position === null) return undefined;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    return range;
  }
  return lookup.caretRangeFromPoint?.(point.x, point.y) ?? undefined;
}
