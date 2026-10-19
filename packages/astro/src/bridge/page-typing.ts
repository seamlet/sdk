import { canEditTextInPlace } from "./element-text";
import { placeCaretAt, startInlineTextEditing } from "./inline-text-editing";
import type { EditorMessage, PageMessage } from "./messages";
import { findMarkedElement } from "./page-markers";
import {
  canEditRichTextInPlace,
  startRichTextEditing,
  type RichTextEditing,
  type TextFormat,
} from "./rich-text-editing";

type StartTyping = Extract<EditorMessage, { type: "start-typing" }>;
type StartRichTyping = Extract<EditorMessage, { type: "start-rich-typing" }>;

export interface PageTyping {
  /** Whether a text is being typed on the page now. */
  readonly isTyping: () => boolean;
  /** Starts typing into the field's element if it shows the text as it is; tells the editor either way. */
  readonly start: (request: StartTyping) => void;
  /** The same for formatted text. */
  readonly startRich: (request: StartRichTyping) => void;
  /** Formats the selection of the formatted text being typed. */
  readonly format: (format: TextFormat) => void;
  /** Sets or removes the link on the selection of the formatted text being typed. */
  readonly setLink: (href: string | undefined) => void;
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
  let richEditing: RichTextEditing | undefined;

  const stop = () => {
    stopEditing?.();
  };
  const ended = (path: string) => (outcome: "kept" | "reverted") => {
    stopEditing = undefined;
    richEditing = undefined;
    options.send({ type: "typing-ended", path, outcome });
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
      onEnd: ended(path),
    });
    placeCaretAt(element, request.point);
  };

  const startRich = (request: StartRichTyping) => {
    stop();
    const { path, isInline } = request;
    const element = findMarkedElement(options.document, path);
    const canType =
      element !== undefined &&
      canEditRichTextInPlace(element, request.text, isInline);
    if (!canType) {
      options.send({ type: "typing-refused", path });
      return;
    }

    options.send({ type: "typing-started", path });
    const editing = startRichTextEditing(element, {
      isInline,
      onInput: (text) => {
        options.send({ type: "rich-typed", path, text });
        options.onInput();
      },
      onSelect: (selection) => {
        options.send({ type: "typed-selection", path, selection });
      },
      onEnd: ended(path),
    });
    richEditing = editing;
    stopEditing = editing.stop;
    placeCaretAt(element, request.point);
  };

  return {
    isTyping: () => stopEditing !== undefined,
    start,
    startRich,
    format: (format) => richEditing?.format(format),
    setLink: (href) => richEditing?.setLink(href),
    stop,
  };
}
