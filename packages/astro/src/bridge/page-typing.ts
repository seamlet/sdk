import {
  EDITABLE_AS_PLAIN_TEXT,
  EDITABLE_AS_RICH_TEXT,
  makeEditable,
  makeUneditable,
  type EditableAs,
} from "./editable-elements";
import { canEditTextInPlace } from "./element-text";
import { isEditedInPopover } from "./held-motion";
import { placeCaretAt, startInlineTextEditing } from "./inline-text-editing";
import type {
  EditorMessage,
  InlineEditingOutcome,
  PageMessage,
  Point,
  TextFormat,
} from "./messages";
import { findMarkedElement } from "./page-markers";
import {
  canEditRichTextInPlace,
  startRichTextEditing,
  type RichTextEditing,
} from "./rich-text-editing";
import { richTextLayoutOf } from "./rich-text-layouts";
import type { TypedKind } from "./typed-fields";

type StartTyping = Extract<EditorMessage, { type: "start-typing" }>;
type StartRichTyping = Extract<EditorMessage, { type: "start-rich-typing" }>;

/** How long a text made ready by a tap waits for the editor to start typing it. */
export const PREPARED_TYPING_TIMEOUT_MS = 3000;

const EDITABLE_VALUES: Readonly<Record<TypedKind, EditableAs>> = {
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
  const { send } = options;
  let typing: CurrentTyping | undefined;
  let prepared: PreparedText | undefined;

  const isTyping = () => typing !== undefined || prepared !== undefined;
  const reportIfOver = () => {
    if (!isTyping()) options.onTypingOver();
  };

  /** The prepared text was not typed: it is left as it was, unless a typing holds it. */
  const releasePrepared = () => {
    if (prepared === undefined) return;
    clearTimeout(prepared.timer);
    if (typing === undefined) {
      prepared.element.blur();
      makeUneditable(prepared.element);
    }
    prepared = undefined;
  };
  /** The prepared text is typed now: the typing takes it over. */
  const handOverPrepared = () => {
    if (prepared !== undefined) clearTimeout(prepared.timer);
    prepared = undefined;
  };
  const prepare = (element: HTMLElement, kind: TypedKind) => {
    const isTypedAlready = element.hasAttribute("contenteditable");
    if (isTypedAlready) return;

    releasePrepared();
    makeEditable(element, EDITABLE_VALUES[kind]);
    element.focus({ preventScroll: true });
    const timer = setTimeout(() => {
      releasePrepared();
      reportIfOver();
    }, PREPARED_TYPING_TIMEOUT_MS);
    prepared = { element, timer };
  };

  const stop = () => {
    typing?.stop();
  };
  const endedAt = (path: string) => (outcome: InlineEditingOutcome) => {
    typing = undefined;
    send({ type: "typing-ended", path, outcome });
    reportIfOver();
  };
  /** Types the field in its element if it can be typed there; tells the editor either way. */
  const begin = (start: TypingStart) => {
    stop();
    const { path } = start;
    const element = findMarkedElement(options.document, path);
    const canType =
      element !== undefined &&
      !isEditedInPopover(element) &&
      start.canTypeIn(element);
    if (!canType) {
      releasePrepared();
      send({ type: "typing-refused", path });
      reportIfOver();
      return;
    }

    handOverPrepared();
    send({ type: "typing-started", path });
    typing = start.typeIn(element, endedAt(path));
    placeCaretAt(element, start.point);
  };

  const reportTyped = (message: PageMessage) => {
    send(message);
    options.onInput();
  };
  const typePlainText = (request: StartTyping) => {
    const { path, text } = request;
    begin({
      path,
      point: request.point,
      canTypeIn: (element) => canEditTextInPlace(element, text),
      typeIn: (element, onEnd) => ({
        stop: startInlineTextEditing(element, {
          isSingleLine: request.isSingleLine,
          onInput: (typed) => {
            reportTyped({ type: "typed", path, text: typed });
          },
          onEnd,
        }),
      }),
    });
  };
  const typeRichText = (request: StartRichTyping) => {
    const { path, text } = request;
    const layout = richTextLayoutOf(request.isInline);
    begin({
      path,
      point: request.point,
      canTypeIn: (element) => canEditRichTextInPlace(element, text, layout),
      typeIn: (element, onEnd) => {
        const editing = startRichTextEditing(element, {
          layout,
          onInput: (typed) => {
            reportTyped({ type: "rich-typed", path, text: typed });
          },
          onSelect: (selection) => {
            send({ type: "typed-selection", path, selection });
          },
          onEnd,
        });
        return { stop: editing.stop, richText: editing };
      },
    });
  };

  return {
    prepare,
    isTyping,
    start: typePlainText,
    startRich: typeRichText,
    format: (format) => typing?.richText?.format(format),
    setLink: (href) => typing?.richText?.setLink(href),
    stop,
  };
}

/** A text a tap made editable, waiting for the editor to start typing it. */
interface PreparedText {
  readonly element: HTMLElement;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** The text typed now. */
interface CurrentTyping {
  readonly stop: () => void;
  /** The formatting of a formatted text; a plain text has none. */
  readonly richText?: RichTextEditing;
}

interface TypingStart {
  readonly path: string;
  readonly point: Point;
  readonly canTypeIn: (element: HTMLElement) => boolean;
  readonly typeIn: (
    element: HTMLElement,
    onEnd: (outcome: InlineEditingOutcome) => void,
  ) => CurrentTyping;
}
