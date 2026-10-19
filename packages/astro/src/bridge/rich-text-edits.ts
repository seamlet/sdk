import {
  normalizedLine,
  type RichBlock,
  type RichLine,
  type RichSpan,
  type RichText,
} from "../schema";
import type { TextFormats } from "./messages";

// What the toolbar of formatted text does to it: marks, links and lists over a selection. A
// selection is given in lines (the paragraphs and the list items, in their order) and characters
// in a line, so a change lands on the same words whatever elements show them.

export interface TextPoint {
  /** The paragraph or the list item, counted from the start of the text. */
  readonly line: number;
  /** Characters from the start of the line; a line break is one character. */
  readonly offset: number;
}

export interface TextSelection {
  readonly start: TextPoint;
  readonly end: TextPoint;
}

export type Mark = "bold" | "italic";

/** A line of the text with the kind of block it belongs to. */
export interface FlatLine {
  readonly kind: "paragraph" | "item";
  readonly spans: RichLine;
}

/** What the selected words have, or the words at the cursor when nothing is selected. */
/** Whether the selection holds no characters: it is a cursor. */
export function isCollapsed(selection: TextSelection): boolean {
  return (
    selection.start.line === selection.end.line &&
    selection.start.offset === selection.end.offset
  );
}

/** The marks every selected word has, and the link they are in. */
export function formatsAt(
  text: RichText,
  selection: TextSelection,
): TextFormats {
  const lines = flatLinesOf(text);
  const spans = isCollapsed(selection)
    ? spansAtCursor(lines, selection.start)
    : selectedSpans(lines, selection);
  const hasSpans = spans.length > 0;
  const firstHref = spans[0]?.href;
  const isInOneLink =
    hasSpans && spans.every((span) => span.href === firstHref);
  const selectedLines = lines.slice(
    selection.start.line,
    selection.end.line + 1,
  );
  return {
    isBold: hasSpans && spans.every((span) => span.bold === true),
    isItalic: hasSpans && spans.every((span) => span.italic === true),
    isList:
      selectedLines.length > 0 &&
      selectedLines.every((line) => line.kind === "item"),
    href: isInOneLink ? firstHref : undefined,
  };
}

/** The words of the link the cursor is in, or undefined outside a link. */
export function linkSelectionAt(
  text: RichText,
  point: TextPoint,
): TextSelection | undefined {
  const line = flatLinesOf(text)[point.line];
  if (line === undefined) return undefined;

  const bounds = spanBoundsOf(line.spans);
  const index = bounds.findIndex(
    (bound) => point.offset >= bound.from && point.offset <= bound.to,
  );
  const href = line.spans[index]?.href;
  if (href === undefined) return undefined;

  // Pieces of one link with other marks (a bold word in it) are the same link.
  const isSameLink = (at: number) => line.spans[at]?.href === href;
  let first = index;
  while (isSameLink(first - 1)) first -= 1;
  let last = index;
  while (isSameLink(last + 1)) last += 1;
  return {
    start: { line: point.line, offset: bounds[first]?.from ?? 0 },
    end: { line: point.line, offset: bounds[last]?.to ?? 0 },
  };
}

/** The mark on every selected word, or off them all when every one has it already. */
export function toggleMark(
  text: RichText,
  selection: TextSelection,
  mark: Mark,
): RichText {
  const lines = flatLinesOf(text);
  const selected = selectedSpans(lines, selection);
  const hasMarkEverywhere =
    selected.length > 0 && selected.every((span) => span[mark] === true);
  return withSelectedSpans(lines, selection, (span) =>
    hasMarkEverywhere ? withoutMark(span, mark) : { ...span, [mark]: true },
  );
}

/** The selected words lead to the address, or lead nowhere when it is undefined. */
export function setLink(
  text: RichText,
  selection: TextSelection,
  href: string | undefined,
): RichText {
  return withSelectedSpans(flatLinesOf(text), selection, (span) =>
    spanOf(span.text, { ...span, href }),
  );
}

/** The selected lines become a list, or paragraphs again when they all are a list already. */
export function toggleList(text: RichText, selection: TextSelection): RichText {
  const lines = flatLinesOf(text);
  const isSelected = (index: number) =>
    index >= selection.start.line && index <= selection.end.line;
  const isListEverywhere = lines.every(
    (line, index) => !isSelected(index) || line.kind === "item",
  );
  const kind: FlatLine["kind"] = isListEverywhere ? "paragraph" : "item";
  const changed = lines.map((line, index) =>
    isSelected(index) ? { ...line, kind } : line,
  );
  return blocksOf(changed);
}

function flatLinesOf(text: RichText): readonly FlatLine[] {
  return text.flatMap((block): readonly FlatLine[] =>
    block.kind === "paragraph"
      ? [{ kind: "paragraph", spans: block.spans }]
      : block.items.map((spans) => ({ kind: "item", spans })),
  );
}

/** Lines back into blocks: neighboring list items are one list. */
export function blocksOf(lines: readonly FlatLine[]): RichText {
  return lines.reduce<RichBlock[]>((blocks, line) => {
    const previous = blocks.at(-1);
    if (line.kind === "paragraph") {
      return [...blocks, { kind: "paragraph", spans: line.spans }];
    }
    if (previous?.kind === "list") {
      const list = {
        kind: "list" as const,
        items: [...previous.items, line.spans],
      };
      return [...blocks.slice(0, -1), list];
    }
    return [...blocks, { kind: "list", items: [line.spans] }];
  }, []);
}

/** The pieces of the selection, cut at its edges. */
function selectedSpans(
  lines: readonly FlatLine[],
  selection: TextSelection,
): readonly RichSpan[] {
  return lines.flatMap((line, index) => {
    const range = rangeInLine(line, index, selection);
    return range === undefined ? [] : piecesIn(line.spans, range).inside;
  });
}

/** The piece the cursor is in: the one before it, as the next typed letter takes its marks. */
function spansAtCursor(
  lines: readonly FlatLine[],
  point: TextPoint,
): readonly RichSpan[] {
  const spans = lines[point.line]?.spans ?? [];
  const bounds = spanBoundsOf(spans);
  const index = bounds.findIndex(
    (bound) => point.offset > bound.from && point.offset <= bound.to,
  );
  const span = spans[index === -1 ? 0 : index];
  return span === undefined ? [] : [span];
}

function spanBoundsOf(spans: RichLine): readonly LineRange[] {
  return spans.reduce<LineRange[]>((bounds, span) => {
    const from = bounds.at(-1)?.to ?? 0;
    return [...bounds, { from, to: from + span.text.length }];
  }, []);
}

function withSelectedSpans(
  lines: readonly FlatLine[],
  selection: TextSelection,
  change: (span: RichSpan) => RichSpan,
): RichText {
  const changed = lines.map((line, index) => {
    const range = rangeInLine(line, index, selection);
    if (range === undefined) return line;

    const { before, inside, after } = piecesIn(line.spans, range);
    const spans = normalizedLine([...before, ...inside.map(change), ...after]);
    return { ...line, spans };
  });
  return blocksOf(changed);
}

interface LineRange {
  readonly from: number;
  readonly to: number;
}

/** The selected characters of a line, or undefined when none of them is. */
function rangeInLine(
  line: FlatLine,
  index: number,
  selection: TextSelection,
): LineRange | undefined {
  const isOutside = index < selection.start.line || index > selection.end.line;
  if (isOutside) return undefined;

  const length = lengthOf(line.spans);
  const from = index === selection.start.line ? selection.start.offset : 0;
  const to = index === selection.end.line ? selection.end.offset : length;
  const range = { from: clamp(from, length), to: clamp(to, length) };
  return range.from < range.to ? range : undefined;
}

interface LinePieces {
  readonly before: readonly RichSpan[];
  readonly inside: readonly RichSpan[];
  readonly after: readonly RichSpan[];
}

/** The pieces of a line before, inside and after a range, cut at its edges. */
function piecesIn(spans: RichLine, range: LineRange): LinePieces {
  const pieces = spans.reduce<{ at: number; cut: RichSpan[] }>(
    (state, span) => {
      const end = state.at + span.text.length;
      const edges = [range.from, range.to].filter(
        (edge) => edge > state.at && edge < end,
      );
      const parts = cutAt(
        span,
        edges.map((edge) => edge - state.at),
      );
      return { at: end, cut: [...state.cut, ...parts] };
    },
    { at: 0, cut: [] },
  ).cut;

  return pieces.reduce<{ at: number } & LinePieces>(
    (state, piece) => {
      const end = state.at + piece.text.length;
      const place = placeOf(state.at, end, range);
      return { ...state, at: end, [place]: [...state[place], piece] };
    },
    { at: 0, before: [], inside: [], after: [] },
  );
}

function placeOf(
  start: number,
  end: number,
  range: LineRange,
): keyof LinePieces {
  if (end <= range.from) return "before";
  if (start >= range.to) return "after";
  return "inside";
}

function cutAt(
  span: RichSpan,
  offsets: readonly number[],
): readonly RichSpan[] {
  const bounds = [0, ...offsets, span.text.length];
  return bounds.slice(1).map((end, index) => ({
    ...span,
    text: span.text.slice(bounds[index], end),
  }));
}

function withoutMark(span: RichSpan, mark: Mark): RichSpan {
  return spanOf(span.text, { ...span, [mark]: false });
}

interface Marks {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly href?: string | undefined;
}

/** A piece with only the marks it has: a mark that is off is no key at all. */
function spanOf(text: string, marks: Marks): RichSpan {
  return {
    text,
    ...(marks.bold === true ? { bold: true } : {}),
    ...(marks.italic === true ? { italic: true } : {}),
    ...(marks.href === undefined ? {} : { href: marks.href }),
  };
}

function lengthOf(spans: RichLine): number {
  return spans.reduce((length, span) => length + span.text.length, 0);
}

function clamp(offset: number, length: number): number {
  return Math.min(Math.max(offset, 0), length);
}
