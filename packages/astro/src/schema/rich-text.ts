import { isJsonObject } from "./json-values";

// Formatted text: paragraphs and lists of pieces, each plain, bold, italic or a link. It is data,
// never HTML: a site renders it with its own elements, so a text typed in the CMS never runs as
// code on the site, and a link leads only where linkTargetOf allows.

/** A piece of a text with its marks; a link is a piece with an address. */
export interface RichSpan {
  readonly text: string;
  readonly bold?: true;
  readonly italic?: true;
  /** A path of the site, a web address, `tel:` or `mailto:`; see linkTargetOf. */
  readonly href?: string;
}

export type RichLine = readonly RichSpan[];

export type RichBlock =
  | { readonly kind: "paragraph"; readonly spans: RichLine }
  | { readonly kind: "list"; readonly items: readonly RichLine[] };

export type RichText = readonly RichBlock[];

/** Paragraphs are separated by an empty line in a plain text. */
const PARAGRAPH_BREAK = /\n\s*\n/u;
const PARAGRAPH_SEPARATOR = "\n\n";
const LINE_SEPARATOR = "\n";
const SPACE = " ";

/** A plain text as paragraphs: how a text field becomes formatted text and keeps its words. */
export function richTextOf(plain: string): RichText {
  return plain
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
    .map((paragraph) => ({ kind: "paragraph", spans: [{ text: paragraph }] }));
}

/** The words of a text without its marks: for a length, a search, a summary. */
export function plainTextOf(text: RichText): string {
  return text.map(plainBlockOf).join(PARAGRAPH_SEPARATOR);
}

/** Every address the links of a text lead to. */
export function linkAddressesOf(text: RichText): readonly string[] {
  return linesOf(text).flatMap((line) =>
    line.flatMap((span) => (span.href === undefined ? [] : [span.href])),
  );
}

/** One paragraph of all the text: a text that stands inside a sentence-level element. */
export function asOneParagraph(text: RichText): RichText {
  const lines = linesOf(text).filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const spans = lines.flatMap((line, index) =>
    index === 0 ? line : [{ text: SPACE }, ...line],
  );
  return [{ kind: "paragraph", spans: normalizedLine(spans) }];
}

/**
 * Formatted text read from any input, or undefined when it is not one: the same text gives the
 * same value, with empty pieces left out and neighbors with the same marks joined.
 */
export function readRichText(input: unknown): RichText | undefined {
  if (!Array.isArray(input)) return undefined;

  const blocks = input.map(readBlock);
  const isEveryBlockRead = blocks.every((block) => block !== undefined);
  if (!isEveryBlockRead) return undefined;
  return blocks.filter(hasWords);
}

/** The same line with empty pieces left out and neighbors with the same marks joined. */
export function normalizedLine(spans: readonly RichSpan[]): RichLine {
  return spans
    .filter((span) => span.text !== "")
    .reduce<RichSpan[]>((joined, span) => {
      const previous = joined.at(-1);
      if (previous !== undefined && haveSameMarks(previous, span)) {
        return [
          ...joined.slice(0, -1),
          { ...previous, text: previous.text + span.text },
        ];
      }
      return [...joined, span];
    }, []);
}

function readBlock(input: unknown): RichBlock | undefined {
  if (!isJsonObject(input)) return undefined;

  if (input["kind"] === "paragraph") {
    const spans = readLine(input["spans"]);
    return spans === undefined ? undefined : { kind: "paragraph", spans };
  }
  if (input["kind"] === "list" && Array.isArray(input["items"])) {
    const items = input["items"].map(readLine);
    const isEveryItemRead = items.every((item) => item !== undefined);
    if (!isEveryItemRead) return undefined;
    return { kind: "list", items: items.filter((item) => item.length > 0) };
  }
  return undefined;
}

function readLine(input: unknown): RichLine | undefined {
  if (!Array.isArray(input)) return undefined;

  const spans = input.map(readSpan);
  const isEverySpanRead = spans.every((span) => span !== undefined);
  return isEverySpanRead ? normalizedLine(spans) : undefined;
}

function readSpan(input: unknown): RichSpan | undefined {
  if (!isJsonObject(input)) return undefined;

  const { text, bold, italic, href } = input;
  const hasValidMarks =
    typeof text === "string" &&
    (bold === undefined || bold === true) &&
    (italic === undefined || italic === true) &&
    (href === undefined || typeof href === "string");
  if (!hasValidMarks) return undefined;

  return {
    text,
    ...(bold === true ? { bold } : {}),
    ...(italic === true ? { italic } : {}),
    ...(typeof href === "string" ? { href } : {}),
  };
}

function haveSameMarks(first: RichSpan, second: RichSpan): boolean {
  return (
    first.bold === second.bold &&
    first.italic === second.italic &&
    first.href === second.href
  );
}

function hasWords(block: RichBlock): boolean {
  return block.kind === "paragraph"
    ? block.spans.length > 0
    : block.items.length > 0;
}

/** The lines of a text: its paragraphs and the items of its lists, in their order. */
export function linesOf(text: RichText): readonly RichLine[] {
  return text.flatMap((block) =>
    block.kind === "paragraph" ? [block.spans] : block.items,
  );
}

function plainBlockOf(block: RichBlock): string {
  return block.kind === "paragraph"
    ? plainLineOf(block.spans)
    : block.items.map(plainLineOf).join(LINE_SEPARATOR);
}

function plainLineOf(line: RichLine): string {
  return line.map((span) => span.text).join("");
}
