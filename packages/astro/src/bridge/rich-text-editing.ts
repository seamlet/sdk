import { readRichText, safeHref, type RichText } from "../schema";
import { EDITABLE_AS_RICH_TEXT } from "./editable-elements";
import type {
  InlineEditingOutcome,
  TextFormat,
  TypedSelection,
} from "./messages";
import { hasMarkedDescendants } from "./page-markers";
import { insertPlainText } from "./rich-text-dom";
import {
  isCollapsed,
  linkSelectionAt,
  setLink,
  toggleList,
  toggleMark,
  type TextSelection,
} from "./rich-text-edits";
import type { RichTextLayout } from "./rich-text-layouts";
import { createSelectionReports } from "./typed-selections";
import { elementListener, startTypingSession } from "./typing-sessions";

// Typing formatted text right in the element of the site's page that shows it. The browser types
// the words; bold, italic, lists and links are applied to the data and the element is rendered
// anew, so what the element holds is always what the site would render.

export interface RichTextEditingOptions {
  /** How the text stands in its element: paragraphs and lists, or the words of one line. */
  readonly layout: RichTextLayout;
  readonly onInput: (text: RichText) => void;
  readonly onSelect: (selection: TypedSelection | undefined) => void;
  readonly onEnd: (outcome: InlineEditingOutcome) => void;
}

export interface RichTextEditing {
  readonly format: (format: TextFormat) => void;
  /**
   * The selected words, or the link at the cursor, lead to the address, or nowhere. An address a
   * link may not have (see safeHref) changes nothing.
   */
  readonly setLink: (href: string | undefined) => void;
  /** Ends the typing and keeps what was typed. */
  readonly stop: () => void;
}

/** A shortcut of the browser's own formatting that must not run: underline. */
type RefusedShortcut = "refused";

/**
 * Whether the formatted text of a field can be typed right in its element: the element shows the
 * value as it is, with nothing else in it, and holds no other marked fields.
 */
export function canEditRichTextInPlace(
  element: HTMLElement,
  value: RichText,
  layout: RichTextLayout,
): boolean {
  if (hasMarkedDescendants(element)) return false;

  const normalized = readRichText(value) ?? [];
  const expected = layout.shapeOf(normalized);
  const shown = layout.read(element);
  return JSON.stringify(shown) === JSON.stringify(expected);
}

/** Makes the element editable until Enter (one line), Escape or a click elsewhere on the page. */
export function startRichTextEditing(
  element: HTMLElement,
  options: RichTextEditingOptions,
): RichTextEditing {
  const { layout } = options;
  const readText = () => layout.read(element);
  const selections = createSelectionReports(
    element,
    readText,
    options.onSelect,
  );

  const reportInput = () => {
    options.onInput(readText());
    selections.follow();
  };
  /** Changes the text and the element together, keeping the same words selected. */
  const change = (changed: RichText, selection: TextSelection) => {
    layout.render(element, changed);
    selections.keep(selection);
    options.onInput(changed);
  };
  const format = (requested: TextFormat) => {
    const selection = selections.current();
    const isRefusedList = requested === "list" && !layout.canHoldLists;
    if (selection === undefined || isRefusedList) return;

    change(formatted(readText(), selection, requested), selection);
  };
  const linkTo = (href: string | undefined) => {
    const selection = selections.last();
    const isUnsafe = href !== undefined && safeHref(href) === undefined;
    if (selection === undefined || isUnsafe) return;

    const current = readText();
    const target = isCollapsed(selection)
      ? linkSelectionAt(current, selection.start)
      : selection;
    if (target === undefined) return;
    change(setLink(current, target, href), selection);
  };

  const blurs = endWhenFocusMovesOnPage(element, () => {
    session.end("kept");
  });
  const session = startTypingSession(element, {
    editableAs: EDITABLE_AS_RICH_TEXT,
    isEndingKey: layout.isEndingKey,
    listeners: [
      elementListener(element, "input", reportInput),
      elementListener(element, "keydown", (event) => {
        formatOnShortcut(event, format);
      }),
      elementListener(element, "paste", (event) => {
        pastePlainText(event, element, layout);
        reportInput();
      }),
      elementListener(element, "drop", refuseDrop),
      elementListener(element, "blur", blurs.listener),
      ...selections.listeners,
    ],
    onStop: () => {
      blurs.stop();
      selections.stop();
    },
    onEnd: (outcome) => {
      options.onSelect(undefined);
      options.onEnd(outcome);
    },
  });

  return {
    format,
    setLink: linkTo,
    stop: () => {
      session.end("kept");
    },
  };
}

function formatted(
  text: RichText,
  selection: TextSelection,
  format: TextFormat,
): RichText {
  return format === "list"
    ? toggleList(text, selection)
    : toggleMark(text, selection, format);
}

function formatOnShortcut(
  event: KeyboardEvent,
  format: (format: TextFormat) => void,
): void {
  const shortcut = formatShortcutOf(event);
  if (shortcut === undefined) return;

  event.preventDefault();
  if (shortcut !== "refused") format(shortcut);
}

/** A pasted text comes without the formatting and the links of where it came from. */
function pastePlainText(
  event: ClipboardEvent,
  element: HTMLElement,
  layout: RichTextLayout,
): void {
  event.preventDefault();
  const pasted = event.clipboardData?.getData("text/plain") ?? "";
  insertPlainText(element, layout.pastedWords(pasted));
}

/** A dropped text would bring the formatting and the links of where it came from. */
function refuseDrop(event: Event): void {
  event.preventDefault();
}

/**
 * Focus that left the page for the editor (its toolbar, the address of a link) keeps the typing;
 * a click elsewhere on the page ends it. The focus has moved only once the blur is over.
 */
function endWhenFocusMovesOnPage(
  element: HTMLElement,
  end: () => void,
): { readonly listener: () => void; readonly stop: () => void } {
  let blurTimer: ReturnType<typeof setTimeout> | undefined;
  const listener = () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      const { ownerDocument } = element;
      const isFocusOnPage = ownerDocument.hasFocus();
      const isFocusInText = ownerDocument.activeElement === element;
      if (isFocusOnPage && !isFocusInText) end();
    });
  };
  return {
    listener,
    stop: () => {
      clearTimeout(blurTimer);
    },
  };
}

/**
 * The formatting a keyboard shortcut asks for; "refused" for a shortcut of the browser's own
 * formatting that must not run, undefined for any other key. Keys are read by their place, so ⌘B
 * works with the Russian layout, where that key types «и».
 */
function formatShortcutOf(
  event: KeyboardEvent,
): TextFormat | RefusedShortcut | undefined {
  const hasCommandKey = event.metaKey || event.ctrlKey;
  if (!hasCommandKey || event.altKey || event.shiftKey) return undefined;

  switch (event.code) {
    case "KeyB":
      return "bold";
    case "KeyI":
      return "italic";
    case "KeyU":
      return "refused";
    default:
      return undefined;
  }
}
