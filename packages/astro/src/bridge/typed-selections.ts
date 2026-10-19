import type { RichText } from "../schema";
import { boxOf, type Box } from "./boxes";
import type { TypedSelection } from "./messages";
import { rangeOf, readSelectionFrom, selectIn } from "./rich-text-dom";
import { formatsAt, isCollapsed, type TextSelection } from "./rich-text-edits";
import { onDocument, onWindow, type EventListening } from "./event-listening";

// Where the selection in a formatted text typed on the page is, reported to the editor once a
// frame at most, for its toolbar. The selection outlives the focus: the editor's toolbar takes the
// focus to set a link's address, and the link goes on the words selected before.

export interface SelectionReports {
  readonly listeners: readonly EventListening[];
  /** The selection in the text now, or the last one a person made there. */
  readonly current: () => TextSelection | undefined;
  /** The last selection a person made in the text. */
  readonly last: () => TextSelection | undefined;
  /** Follows a selection the typing moved: the typed characters. */
  readonly follow: () => void;
  /** Keeps the selection over the same words in the text rendered anew. */
  readonly keep: (selection: TextSelection) => void;
  readonly stop: () => void;
}

export function createSelectionReports(
  element: HTMLElement,
  readText: () => RichText,
  onSelect: (selection: TypedSelection | undefined) => void,
): SelectionReports {
  const document = element.ownerDocument;
  const view = document.defaultView;
  let lastSelection: TextSelection | undefined;
  let reportFrame: number | undefined;

  const liveSelection = () =>
    isSelectionIn(element) ? readSelectionFrom(element) : undefined;
  const report = () => {
    reportFrame = undefined;
    onSelect(measureSelection(element, readText(), lastSelection));
  };
  const schedule = () => {
    if (reportFrame !== undefined) return;
    reportFrame = view?.requestAnimationFrame(report);
  };
  const follow = () => {
    // Only a person on the page moves the selection; a page without the focus changes it only
    // when its element is rendered anew under the editor's toolbar.
    const selection = document.hasFocus() ? liveSelection() : undefined;
    if (selection === undefined) return;
    lastSelection = selection;
    schedule();
  };
  const keep = (selection: TextSelection) => {
    lastSelection = selection;
    // Selecting in a page that lost the focus to the editor would take the focus back.
    if (document.hasFocus()) selectIn(element, selection);
    schedule();
  };

  return {
    listeners: [
      onDocument(document, "selectionchange", follow),
      onDocument(document, "scroll", schedule),
      ...onWindow(view, "resize", schedule),
    ],
    current: () => liveSelection() ?? lastSelection,
    last: () => lastSelection,
    follow,
    keep,
    stop: () => {
      if (reportFrame !== undefined) view?.cancelAnimationFrame(reportFrame);
    },
  };
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
  const hasOwnBox = whole.width > 0 || whole.height > 0;
  const rectangle = hasOwnBox ? whole : range.getClientRects()[0];
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
