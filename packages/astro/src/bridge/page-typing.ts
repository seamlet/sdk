import { makeEditable, makeUneditable } from "./editable-elements";
import { canEditTextInPlace } from "./element-text";
import {
  EDITABLE_AS_PLAIN_TEXT,
  placeCaretAt,
  startInlineTextEditing,
} from "./inline-text-editing";
import type { EditorMessage, PageMessage } from "./messages";
import { findMarkedElement } from "./page-markers";
import {
  canEditRichTextInPlace,
  EDITABLE_AS_RICH_TEXT,
  startRichTextEditing,
  type RichTextEditing,
  type TextFormat,
} from "./rich-text-editing";
import type { TypedKind } from "./typed-fields";

type StartTyping = Extract<EditorMessage, { type: "start-typing" }>;
type StartRichTyping = Extract<EditorMessage, { type: "start-rich-typing" }>;

/** How long a text made ready by a tap waits for the editor to start typing it. */
export const PREPARED_TYPING_TIMEOUT_MS = 3000;

const EDITABLE_VALUES: Readonly<Record<TypedKind, string>> = {
  plain: EDITABLE_AS_PLAIN_TEXT,
  rich: EDITABLE_AS_RICH_TEXT,
};

export interface PageTyping {
  /**
   * Makes the text a person tapped editable and focused at once, while the tap still lets the
   * page take the focus: a phone shows its keyboard only for a focus a tap gives. The editor
   * then starts the typing, or the text is left as it was.
   */
  readonly prepare: (element: HTMLElement, kind: TypedKind) => void;
  /** Whether a text is being typed on the page now, or was made ready to be by a tap. */
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
  /** Nothing is typed or made ready to be typed any more: the page may be rendered anew. */
  readonly onTypingOver: () => void;
}): PageTyping {
  let stopEditing: (() => void) | undefined;
  let richEditing: RichTextEditing | undefined;
  let prepared:
    | {
        readonly element: HTMLElement;
        readonly timer: ReturnType<typeof setTimeout>;
      }
    | undefined;

  const isTyping = () => stopEditing !== undefined || prepared !== undefined;
  const reportIfOver = () => {
    if (!isTyping()) options.onTypingOver();
  };

  /** The prepared text, now typed or refused: the typing takes it over, or it is left. */
  const takePrepared = (isTyped: boolean) => {
    if (prepared === undefined) return;
    clearTimeout(prepared.timer);
    if (!isTyped && stopEditing === undefined) {
      prepared.element.blur();
      makeUneditable(prepared.element);
    }
    prepared = undefined;
  };
  const prepare = (element: HTMLElement, kind: TypedKind) => {
    const isTypedAlready = element.hasAttribute("contenteditable");
    if (isTypedAlready) return;
    takePrepared(false);
    makeEditable(element, EDITABLE_VALUES[kind]);
    element.focus({ preventScroll: true });
    const timer = setTimeout(() => {
      takePrepared(false);
      reportIfOver();
    }, PREPARED_TYPING_TIMEOUT_MS);
    prepared = { element, timer };
  };

  const stop = () => {
    stopEditing?.();
  };
  const ended = (path: string) => (outcome: "kept" | "reverted") => {
    stopEditing = undefined;
    richEditing = undefined;
    options.send({ type: "typing-ended", path, outcome });
    reportIfOver();
  };

  const start = (request: StartTyping) => {
    stop();
    const { path } = request;
    const element = findMarkedElement(options.document, path);
    const canType =
      element !== undefined && canEditTextInPlace(element, request.text);
    if (!canType) {
      takePrepared(false);
      options.send({ type: "typing-refused", path });
      reportIfOver();
      return;
    }

    takePrepared(true);
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
      takePrepared(false);
      options.send({ type: "typing-refused", path });
      reportIfOver();
      return;
    }

    takePrepared(true);
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
    prepare,
    isTyping,
    start,
    startRich,
    format: (format) => richEditing?.format(format),
    setLink: (href) => richEditing?.setLink(href),
    stop,
  };
}
