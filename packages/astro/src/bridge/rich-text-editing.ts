import { asOneParagraph, readRichText, type RichText } from "../schema";
import { boxOf, type Box } from "./boxes";
import { makeEditable, makeUneditable } from "./editable-elements";
import type { InlineEditingOutcome } from "./inline-text-editing";
import { hasMarkedDescendants } from "./page-markers";
import {
  insertPlainText,
  rangeOf,
  readRichTextFrom,
  readSelectionFrom,
  renderInlineRichText,
  renderRichText,
  selectIn,
} from "./rich-text-dom";
import {
  formatsAt,
  isCollapsed,
  linkSelectionAt,
  setLink,
  toggleList,
  toggleMark,
  type TextFormats,
  type TextSelection,
} from "./rich-text-edits";

// Typing formatted text right in the element of the site's page that shows it. The browser types
// the words; bold, italic, lists and links are applied to the data and the element is rendered
// anew, so what the element holds is always what the site would render.

/** A change of formatting the editor's toolbar asks for. */
export type TextFormat = "bold" | "italic" | "list";

/** The selection in the typed text: where it is on the page and what its words have. */
export interface TypedSelection {
  readonly box: Box;
  readonly isCollapsed: boolean;
  readonly formats: TextFormats;
}

export interface RichTextEditingOptions {
  /** The words alone, in an element of one line: Enter ends the typing, lists are not made. */
  readonly isInline: boolean;
  readonly onInput: (text: RichText) => void;
  readonly onSelect: (selection: TypedSelection | undefined) => void;
  readonly onEnd: (outcome: InlineEditingOutcome) => void;
}

export interface RichTextEditing {
  readonly format: (format: TextFormat) => void;
  /** The selected words, or the link at the cursor, lead to the address, or nowhere. */
  readonly setLink: (href: string | undefined) => void;
  /** Ends the typing and keeps what was typed. */
  readonly stop: () => void;
}

export const EDITABLE_AS_RICH_TEXT = "true";
const PASTED_LINE_BREAKS = /\s*\n\s*/gu;
const SPACE = " ";

/**
 * Whether the formatted text of a field can be typed right in its element: the element shows the
 * value as it is, with nothing else in it, and holds no other marked fields.
 */
export function canEditRichTextInPlace(
  element: HTMLElement,
  value: RichText,
  isInline: boolean,
): boolean {
  if (hasMarkedDescendants(element)) return false;

  const normalized = readRichText(value) ?? [];
  const expected = isInline ? asOneParagraph(normalized) : normalized;
  const shown = readTextOf(element, isInline);
  return JSON.stringify(shown) === JSON.stringify(expected);
}

/** Makes the element editable until Enter (inline), Escape or a click elsewhere on the page. */
export function startRichTextEditing(
  element: HTMLElement,
  options: RichTextEditingOptions,
): RichTextEditing {
  const document = element.ownerDocument;
  const view = document.defaultView;
  // The selection outlives the focus: the editor's toolbar takes it to set a link's address.
  let lastSelection: TextSelection | undefined;
  let reportFrame: number | undefined;
  let blurTimer: ReturnType<typeof setTimeout> | undefined;

  const readText = () => readTextOf(element, options.isInline);
  const liveSelection = () =>
    isSelectionIn(element) ? readSelectionFrom(element) : undefined;

  const reportSelection = () => {
    reportFrame = undefined;
    options.onSelect(measureSelection(element, readText(), lastSelection));
  };
  const scheduleReport = () => {
    if (reportFrame !== undefined) return;
    reportFrame = view?.requestAnimationFrame(reportSelection);
  };
  const followSelection = () => {
    // Only a person on the page moves the selection; a page without the focus changes it only
    // when its element is rendered anew under the editor's toolbar.
    const selection = document.hasFocus() ? liveSelection() : undefined;
    if (selection === undefined) return;
    lastSelection = selection;
    scheduleReport();
  };

  const reportInput = () => {
    options.onInput(readText());
    followSelection();
  };
  /** Changes the text and the element together, keeping the same words selected. */
  const change = (changed: RichText, selection: TextSelection) => {
    render(element, changed, options.isInline);
    lastSelection = selection;
    // Selecting in a page that lost the focus to the editor would take the focus back.
    if (document.hasFocus()) selectIn(element, selection);
    options.onInput(changed);
    scheduleReport();
  };

  const format = (requested: TextFormat) => {
    const selection = liveSelection() ?? lastSelection;
    const isListInLine = requested === "list" && options.isInline;
    if (selection === undefined || isListInLine) return;

    const current = readText();
    const changed =
      requested === "list"
        ? toggleList(current, selection)
        : toggleMark(current, selection, requested);
    change(changed, selection);
  };
  const linkTo = (href: string | undefined) => {
    const selection = lastSelection;
    if (selection === undefined) return;

    const current = readText();
    const target = isCollapsed(selection)
      ? linkSelectionAt(current, selection.start)
      : selection;
    if (target === undefined) return;
    change(setLink(current, target, href), selection);
  };

  const pressKey = (event: KeyboardEvent) => {
    const isEnd = event.key === "Enter" && options.isInline && !event.shiftKey;
    const shortcut = formatShortcutOf(event);
    if (event.key === "Escape") {
      event.preventDefault();
      end("reverted");
    } else if (isEnd) {
      event.preventDefault();
      end("kept");
    } else if (shortcut !== undefined) {
      event.preventDefault();
      if (shortcut !== "none") format(shortcut);
    }
  };
  const pastePlainText = (event: ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text/plain") ?? "";
    const words = options.isInline
      ? pasted.replace(PASTED_LINE_BREAKS, SPACE)
      : pasted;
    insertPlainText(element, words);
    reportInput();
  };
  // A dropped text would bring the formatting and the links of where it came from.
  const refuseDrop = (event: DragEvent) => {
    event.preventDefault();
  };
  // Focus that left the page for the editor (its toolbar, the address of a link) keeps the
  // typing; a click elsewhere on the page ends it.
  const endOnBlur = () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      const isFocusOnPage = document.hasFocus();
      const isFocusInText = document.activeElement === element;
      if (isFocusOnPage && !isFocusInText) end("kept");
    });
  };

  const stopListening = () => {
    clearTimeout(blurTimer);
    if (reportFrame !== undefined) view?.cancelAnimationFrame(reportFrame);
    element.removeEventListener("input", reportInput);
    element.removeEventListener("keydown", pressKey);
    element.removeEventListener("paste", pastePlainText);
    element.removeEventListener("drop", refuseDrop);
    element.removeEventListener("blur", endOnBlur);
    document.removeEventListener("selectionchange", followSelection);
    document.removeEventListener("scroll", scheduleReport, true);
    view?.removeEventListener("resize", scheduleReport);
    makeUneditable(element);
  };
  let hasEnded = false;
  const end = (outcome: InlineEditingOutcome) => {
    if (hasEnded) return;
    hasEnded = true;
    stopListening();
    options.onSelect(undefined);
    options.onEnd(outcome);
  };

  makeEditable(element, EDITABLE_AS_RICH_TEXT);
  element.addEventListener("input", reportInput);
  element.addEventListener("keydown", pressKey);
  element.addEventListener("paste", pastePlainText);
  element.addEventListener("drop", refuseDrop);
  element.addEventListener("blur", endOnBlur);
  document.addEventListener("selectionchange", followSelection);
  document.addEventListener("scroll", scheduleReport, true);
  view?.addEventListener("resize", scheduleReport);
  element.focus();
  return {
    format,
    setLink: linkTo,
    stop: () => {
      end("kept");
    },
  };
}

function readTextOf(element: HTMLElement, isInline: boolean): RichText {
  const read = readRichTextFrom(element);
  return isInline ? asOneParagraph(read) : read;
}

function render(element: HTMLElement, text: RichText, isInline: boolean) {
  if (isInline) renderInlineRichText(element, text);
  else renderRichText(element, text);
}

function measureSelection(
  element: HTMLElement,
  text: RichText,
  selection: TextSelection | undefined,
): TypedSelection | undefined {
  if (selection === undefined) return undefined;

  const range = isSelectionIn(element)
    ? element.ownerDocument.getSelection()?.getRangeAt(0)
    : rangeOf(element, selection);
  const box =
    (range === undefined ? undefined : boxOfRange(range)) ?? boxOf(element);
  if (box === undefined) return undefined;
  return {
    box,
    isCollapsed: isCollapsed(selection),
    formats: formatsAt(text, selection),
  };
}

/** The box of a range; a cursor has no box of its own, only the line it stands in. */
function boxOfRange(range: Range): Box | undefined {
  const whole = range.getBoundingClientRect();
  const rectangle =
    whole.width > 0 || whole.height > 0 ? whole : range.getClientRects()[0];
  if (rectangle === undefined) return undefined;
  const isShown = rectangle.width > 0 || rectangle.height > 0;
  if (!isShown) return undefined;
  return {
    top: rectangle.top,
    left: rectangle.left,
    width: rectangle.width,
    height: rectangle.height,
  };
}

function isSelectionIn(element: HTMLElement): boolean {
  const selection = element.ownerDocument.getSelection();
  const anchor = selection?.anchorNode ?? null;
  const hasRange = (selection?.rangeCount ?? 0) > 0;
  return hasRange && anchor !== null && element.contains(anchor);
}

/**
 * The formatting a keyboard shortcut asks for; "none" for a shortcut of the browser's own
 * formatting that must not run (underline), undefined for any other key. Keys are read by their
 * place, so ⌘B works with the Russian layout, where that key types «и».
 */
function formatShortcutOf(
  event: KeyboardEvent,
): TextFormat | "none" | undefined {
  const hasCommandKey = event.metaKey || event.ctrlKey;
  if (!hasCommandKey || event.altKey || event.shiftKey) return undefined;

  switch (event.code) {
    case "KeyB":
      return "bold";
    case "KeyI":
      return "italic";
    case "KeyU":
      return "none";
    default:
      return undefined;
  }
}
