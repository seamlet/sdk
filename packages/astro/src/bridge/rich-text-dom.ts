import {
  linesOf,
  normalizedLine,
  safeHref,
  type RichBlock,
  type RichLine,
  type RichSpan,
  type RichText,
} from "../schema";
import {
  blocksOf,
  type FlatLine,
  type TextPoint,
  type TextSelection,
} from "./rich-text-edits";

// Formatted text in the editable element of its field, and back: the element shows the text as
// the site does (the CMS's own field, or the site's element on its page), what a person types or
// marks there is read back into the same data, and the selection is read and put back in lines
// and characters, the same whatever elements show them.

const LINE_BREAK = "\n";
const BOLD_TAGS = new Set(["b", "strong"]);
const ITALIC_TAGS = new Set(["i", "em"]);
const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "blockquote"]);
const LIST_TAGS = new Set(["ul", "ol"]);
/** The lines of a text as this module renders it. */
const LINE_SELECTOR = "p, li";
// HTML collapses only ASCII whitespace; a no-break space typed by a person stays.
const COLLAPSIBLE_WHITESPACE = /[\t\n\f\r ]+/gu;
const LEADING_WHITESPACE = /^[\t\n\f\r ]+/u;
const TRAILING_WHITESPACE = /[\t\n\f\r ]+$/u;
const SPACE = " ";

interface Marks {
  readonly bold?: true;
  readonly italic?: true;
  readonly href?: string;
}

interface DomPoint {
  readonly node: Node;
  readonly offset: number;
}

/** The elements of a text, put into the editable element in place of what it held. */
export function renderRichText(element: HTMLElement, text: RichText): void {
  const document = element.ownerDocument;
  const blocks = text.map((block) => blockElement(document, block));
  element.replaceChildren(...blocks);
}

/**
 * The words of a text alone, for an element of one line (`<h1>`): its lines are joined with line
 * breaks, as `RichText` with `inline` renders them.
 */
export function renderInlineRichText(
  element: HTMLElement,
  text: RichText,
): void {
  const document = element.ownerDocument;
  const lines = linesOf(text);
  const nodes = lines.flatMap((line, index) => [
    ...(index > 0 ? [document.createElement("br")] : []),
    ...lineNodes(document, line),
  ]);
  element.replaceChildren(...nodes);
}

/** What the editable element holds now, as formatted text. */
export function readRichTextFrom(element: HTMLElement): RichText {
  return blocksOf(readLines(element, []).lines);
}

/** Where the selection is in the text of the element, or undefined when it is elsewhere. */
export function readSelectionFrom(
  element: HTMLElement,
): TextSelection | undefined {
  const selection = element.ownerDocument.getSelection();
  if (selection === null) return undefined;
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (anchor === null || focus === null) return undefined;

  const points = [
    { node: anchor, offset: selection.anchorOffset },
    { node: focus, offset: selection.focusOffset },
  ];
  const [first, second] = readLines(element, points).points;
  if (first === undefined || second === undefined) return undefined;
  return isBefore(second, first)
    ? { start: second, end: first }
    : { start: first, end: second };
}

/** Puts the selection on the text of an element this module rendered. */
export function selectIn(element: HTMLElement, selection: TextSelection): void {
  const range = rangeOf(element, selection);
  if (range === undefined) return;

  element.ownerDocument
    .getSelection()
    ?.setBaseAndExtent(
      range.startContainer,
      range.startOffset,
      range.endContainer,
      range.endOffset,
    );
}

/** The range of the element's text a selection covers, to select it or to measure it. */
export function rangeOf(
  element: HTMLElement,
  selection: TextSelection,
): Range | undefined {
  // The start leans into the piece after it, the end into the piece before: a selection of a
  // whole link starts and ends inside the link.
  const start = domPointOf(element, selection.start, "forward");
  const end = domPointOf(element, selection.end, "backward");
  if (start === undefined || end === undefined) return undefined;

  const range = element.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

/** Puts plain words in place of the selection, their line breaks as `<br>`, the cursor after them. */
export function insertPlainText(element: HTMLElement, words: string): void {
  const document = element.ownerDocument;
  const selection = document.getSelection();
  const range =
    selection?.rangeCount === 1 ? selection.getRangeAt(0) : undefined;
  const isInElement =
    range !== undefined && element.contains(range.commonAncestorContainer);
  if (selection === null || !isInElement) return;

  const inserted = [...wordsNode(document, words).childNodes];
  const last = inserted.at(-1);
  range.deleteContents();
  inserted.reverse().forEach((node) => {
    range.insertNode(node);
  });
  if (last !== undefined) range.setStartAfter(last);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function blockElement(document: Document, block: RichBlock): HTMLElement {
  if (block.kind === "paragraph") {
    const paragraph = document.createElement("p");
    paragraph.append(...lineNodes(document, block.spans));
    return paragraph;
  }

  const list = document.createElement("ul");
  const items = block.items.map((item) => {
    const listItem = document.createElement("li");
    listItem.append(...lineNodes(document, item));
    return listItem;
  });
  list.append(...items);
  return list;
}

function lineNodes(document: Document, line: RichLine): readonly Node[] {
  return line.map((span) => spanNode(document, span));
}

function spanNode(document: Document, span: RichSpan): Node {
  const words = wordsNode(document, span.text);
  const italic = span.italic === true ? wrapped(document, "em", words) : words;
  const bold =
    span.bold === true ? wrapped(document, "strong", italic) : italic;
  // The CMS renders formatted text on its own origin too: an address a link may not have, as an
  // unsaved draft may hold, is never put on the page.
  const href = span.href === undefined ? undefined : safeHref(span.href);
  if (href === undefined) return bold;

  const link = wrapped(document, "a", bold);
  link.setAttribute("href", href);
  return link;
}

/** The words with their line breaks. */
function wordsNode(document: Document, text: string): Node {
  const fragment = document.createDocumentFragment();
  text.split(LINE_BREAK).forEach((line, index) => {
    if (index > 0) fragment.append(document.createElement("br"));
    fragment.append(document.createTextNode(line));
  });
  return fragment;
}

function wrapped(document: Document, tag: string, content: Node): Element {
  const element = document.createElement(tag);
  element.append(content);
  return element;
}

interface ReadLines {
  readonly lines: readonly FlatLine[];
  /** The points asked for, in the lines that were kept. */
  readonly points: readonly (TextPoint | undefined)[];
}

/**
 * The lines the element holds, as a browser leaves them after typing too: lines in divs, text
 * beside them, b and i, a line break closing a line. Blank lines are left out, and the points
 * asked for are found in the lines that stay.
 */
function readLines(
  element: HTMLElement,
  points: readonly DomPoint[],
): ReadLines {
  const reader = createLineReader(points);
  element.childNodes.forEach((child, index) => {
    reader.markChildPoint(element, index);
    readTopLevel(reader, child);
  });
  reader.markChildPoint(element, element.childNodes.length);
  return reader.finish();
}

function readTopLevel(reader: LineReader, node: Node): void {
  const tag = tagOf(node);
  if (tag !== undefined && LIST_TAGS.has(tag)) {
    [...node.childNodes].forEach((item, index) => {
      reader.markChildPoint(node, index);
      if (tagOf(item) !== "li") return;
      reader.startLine("item");
      readInline(reader, item, {});
      reader.endLine();
    });
    return;
  }
  if (tag !== undefined && BLOCK_TAGS.has(tag)) {
    reader.startLine("paragraph");
    readInline(reader, node, {});
    reader.endLine();
    return;
  }
  reader.continueLooseLine();
  readInline(reader, node, {});
}

function readInline(reader: LineReader, node: Node, marks: Marks): void {
  if (node.nodeType === node.TEXT_NODE) {
    // Line breaks are `<br>`; a line break in a text node is the whitespace of the markup.
    const text = (node.textContent ?? "").replace(
      COLLAPSIBLE_WHITESPACE,
      SPACE,
    );
    reader.addText(node, text, marks);
    return;
  }
  const tag = tagOf(node);
  if (tag === undefined) return;
  if (tag === "br") {
    reader.addText(undefined, LINE_BREAK, marks);
    return;
  }

  const inner = marksOf(node as Element, tag, marks);
  node.childNodes.forEach((child, index) => {
    reader.markChildPoint(node, index);
    readInline(reader, child, inner);
  });
  reader.markChildPoint(node, node.childNodes.length);
}

interface LineReader {
  readonly startLine: (kind: FlatLine["kind"]) => void;
  readonly endLine: () => void;
  /** Text beside the blocks joins the line before it, unless that line was a block. */
  readonly continueLooseLine: () => void;
  readonly addText: (
    node: Node | undefined,
    text: string,
    marks: Marks,
  ) => void;
  /** A point that names an element and the place among its children. */
  readonly markChildPoint: (parent: Node, index: number) => void;
  readonly finish: () => ReadLines;
}

interface OpenLine {
  readonly kind: FlatLine["kind"];
  readonly spans: RichSpan[];
  length: number;
}

function createLineReader(points: readonly DomPoint[]): LineReader {
  const lines: OpenLine[] = [];
  const found: ({ line: number; offset: number } | undefined)[] = points.map(
    () => undefined,
  );
  let isLooseOpen = false;

  const current = (): OpenLine => {
    const line = lines.at(-1);
    if (line !== undefined) return line;
    const first: OpenLine = { kind: "paragraph", spans: [], length: 0 };
    lines.push(first);
    return first;
  };
  const mark = (
    isAt: (point: DomPoint) => boolean,
    offsetIn: (point: DomPoint) => number,
  ) => {
    points.forEach((point, index) => {
      if (found[index] !== undefined || !isAt(point)) return;
      found[index] = {
        line: lines.length - 1,
        offset: current().length + offsetIn(point),
      };
    });
  };

  return {
    startLine: (kind) => {
      lines.push({ kind, spans: [], length: 0 });
      isLooseOpen = false;
    },
    endLine: () => {
      isLooseOpen = false;
    },
    continueLooseLine: () => {
      if (isLooseOpen) return;
      lines.push({ kind: "paragraph", spans: [], length: 0 });
      isLooseOpen = true;
    },
    addText: (node, text, marks) => {
      current();
      if (node !== undefined)
        mark(
          (point) => point.node === node,
          (point) => point.offset,
        );
      const line = current();
      line.spans.push({ text, ...marks });
      line.length += text.length;
    },
    markChildPoint: (parent, index) => {
      current();
      mark(
        (point) => point.node === parent && point.offset === index,
        () => 0,
      );
    },
    finish: () => finishedLines(lines, found),
  };
}

/** Lines without the line break a browser leaves at their end, blank ones left out. */
function finishedLines(
  lines: readonly OpenLine[],
  found: readonly ({ line: number; offset: number } | undefined)[],
): ReadLines {
  const trimmed = lines.map((line) => ({
    kind: line.kind,
    spans: trimmedLine(line.spans),
  }));
  const keptIndexes = trimmed.flatMap((line, index) =>
    line.spans.length > 0 ? [index] : [],
  );
  const kept = keptIndexes.flatMap((index) => trimmed[index] ?? []);
  const points = found.map((point) =>
    point === undefined ? undefined : keptPoint(point, keptIndexes, kept),
  );
  return { lines: kept, points };
}

/** A point in a blank line moves to the start of the next line kept, or the end of the last. */
function keptPoint(
  point: { readonly line: number; readonly offset: number },
  keptIndexes: readonly number[],
  kept: readonly FlatLine[],
): TextPoint | undefined {
  const sameLine = keptIndexes.indexOf(point.line);
  if (sameLine !== -1) {
    const length = lengthOf(kept[sameLine]?.spans ?? []);
    return { line: sameLine, offset: Math.min(point.offset, length) };
  }
  const nextLine = keptIndexes.findIndex((index) => index > point.line);
  if (nextLine !== -1) return { line: nextLine, offset: 0 };

  const lastLine = kept.length - 1;
  if (lastLine < 0) return undefined;
  return { line: lastLine, offset: lengthOf(kept[lastLine]?.spans ?? []) };
}

function trimmedLine(spans: readonly RichSpan[]): RichLine {
  const line = normalizedLine(spans);
  const last = line.at(-1);
  const withoutClosingBreak =
    last !== undefined && last.text.endsWith(LINE_BREAK)
      ? [...line.slice(0, -1), { ...last, text: last.text.slice(0, -1) }]
      : line;
  const isBlank = withoutClosingBreak.every((span) => span.text.trim() === "");
  return isBlank ? [] : withoutEdgeWhitespace(withoutClosingBreak);
}

/** A line without the whitespace of the markup around it, which the page never shows. */
function withoutEdgeWhitespace(spans: RichLine): RichLine {
  const lastIndex = spans.length - 1;
  const trimmed = spans.map((span, index) => {
    const withoutLeading =
      index === 0 ? span.text.replace(LEADING_WHITESPACE, "") : span.text;
    const text =
      index === lastIndex
        ? withoutLeading.replace(TRAILING_WHITESPACE, "")
        : withoutLeading;
    return { ...span, text };
  });
  return normalizedLine(trimmed);
}

/** The place in the rendered element of a point of the text. */
function domPointOf(
  element: HTMLElement,
  point: TextPoint,
  lean: "forward" | "backward",
): DomPoint | undefined {
  const line = lineElementsOf(element)[point.line];
  if (line === undefined) return undefined;

  const walker = element.ownerDocument.createTreeWalker(
    line,
    NodeFilter.SHOW_ALL,
  );
  let left = point.offset;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.nodeType === node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      const isHere = lean === "forward" ? left < length : left <= length;
      if (isHere) return { node, offset: left };
      left -= length;
    } else if (tagOf(node) === "br") {
      if (left === 0) return beforeNode(node);
      left -= 1;
    }
  }
  return { node: line, offset: line.childNodes.length };
}

/** The paragraphs and the items of a text, or the element itself for the words alone. */
function lineElementsOf(element: HTMLElement): readonly Element[] {
  const lines = [...element.querySelectorAll(LINE_SELECTOR)];
  return lines.length > 0 ? lines : [element];
}

function beforeNode(node: Node): DomPoint | undefined {
  const parent = node.parentNode;
  if (parent === null) return undefined;
  return {
    node: parent,
    offset: [...parent.childNodes].indexOf(node as ChildNode),
  };
}

function marksOf(element: Element, tag: string, marks: Marks): Marks {
  const href = tag === "a" ? element.getAttribute("href") : null;
  return {
    ...marks,
    ...(BOLD_TAGS.has(tag) ? { bold: true } : {}),
    ...(ITALIC_TAGS.has(tag) ? { italic: true } : {}),
    ...(href === null ? {} : { href }),
  };
}

function tagOf(node: Node): string | undefined {
  return node.nodeType === node.ELEMENT_NODE
    ? (node as Element).localName
    : undefined;
}

function isBefore(first: TextPoint, second: TextPoint): boolean {
  return (
    first.line < second.line ||
    (first.line === second.line && first.offset < second.offset)
  );
}

function lengthOf(spans: RichLine): number {
  return spans.reduce((length, span) => length + span.text.length, 0);
}
