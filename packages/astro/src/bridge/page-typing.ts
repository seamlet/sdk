import { canEditTextInPlace } from "./element-text";
import { placeCaretAt, startInlineTextEditing } from "./inline-text-editing";
import type { EditorMessage, PageMessage } from "./messages";
import { findMarkedElement } from "./page-markers";

type StartTyping = Extract<EditorMessage, { type: "start-typing" }>;

export interface PageTyping {
  /** Whether a text is being typed on the page now. */
  readonly isTyping: () => boolean;
  /** Starts typing into the field's element if it shows the text as it is; tells the editor either way. */
  readonly start: (request: StartTyping) => void;
  /** Ends the typing and keeps what was typed. */
  readonly stop: () => void;
}

/**
 * Typing a text field right in its element on the page. The editor names the field and its text;
 * every typed character goes back to the editor, which keeps the draft.
 */
export function createPageTyping(options: {
  readonly document: Document;
  readonly send: (message: PageMessage) => void;
  /** A typed character changed the page: what the editor draws over it must move. */
  readonly onInput: () => void;
}): PageTyping {
  let stopEditing: (() => void) | undefined;

  const stop = () => {
    stopEditing?.();
  };

  const start = (request: StartTyping) => {
    stop();
    const { path } = request;
    const element = findMarkedElement(options.document, path);
    const canType =
      element !== undefined && canEditTextInPlace(element, request.text);
    if (!canType) {
      options.send({ type: "typing-refused", path });
      return;
    }

    options.send({ type: "typing-started", path });
    stopEditing = startInlineTextEditing(element, {
      isSingleLine: request.isSingleLine,
      onInput: (text) => {
        options.send({ type: "typed", path, text });
        options.onInput();
      },
      onEnd: (outcome) => {
        stopEditing = undefined;
        options.send({ type: "typing-ended", path, outcome });
      },
    });
    placeCaretAt(element, request.point);
  };

  return { isTyping: () => stopEditing !== undefined, start, stop };
}
