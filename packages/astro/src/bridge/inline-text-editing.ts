import { makeEditable, makeUneditable } from "./editable-elements";
import { readElementText } from "./element-text";
import type { InlineEditingOutcome } from "./messages";

// Editing a text right in the element of the site's page that shows it. The element becomes
// editable as plain text, so the site's markup inside it is never changed by formatting.

export interface InlineTextEditingOptions {
  /** A single-line field ends its editing on Enter instead of taking a line break. */
  readonly isSingleLine: boolean;
  readonly onInput: (text: string) => void;
  readonly onEnd: (outcome: InlineEditingOutcome) => void;
}

export const EDITABLE_AS_PLAIN_TEXT = "plaintext-only";

/** Makes the element editable until Enter (single line), Escape or a click elsewhere; returns a stop. */
export function startInlineTextEditing(
  element: HTMLElement,
  options: InlineTextEditingOptions,
): () => void {
  const reportInput = () => {
    options.onInput(readElementText(element));
  };
  const endOnKey = (event: KeyboardEvent) => {
    const isEnd = event.key === "Enter" && options.isSingleLine;
    if (event.key === "Escape") {
      event.preventDefault();
      end("reverted");
    } else if (isEnd) {
      event.preventDefault();
      end("kept");
    }
  };
  const endOnBlur = () => {
    end("kept");
  };

  const stop = () => {
    element.removeEventListener("input", reportInput);
    element.removeEventListener("keydown", endOnKey);
    element.removeEventListener("blur", endOnBlur);
    makeUneditable(element);
  };
  let hasEnded = false;
  const end = (outcome: InlineEditingOutcome) => {
    if (hasEnded) return;
    hasEnded = true;
    stop();
    options.onEnd(outcome);
  };

  makeEditable(element, EDITABLE_AS_PLAIN_TEXT);
  element.addEventListener("input", reportInput);
  element.addEventListener("keydown", endOnKey);
  element.addEventListener("blur", endOnBlur);
  element.focus();
  return () => {
    end("kept");
  };
}

/** Puts the caret where a person clicked, as a click into an editable text would. */
export function placeCaretAt(
  element: HTMLElement,
  point: { readonly x: number; readonly y: number },
): void {
  const document = element.ownerDocument;
  const selection = document.getSelection();
  const range = caretRangeAt(document, point);
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
