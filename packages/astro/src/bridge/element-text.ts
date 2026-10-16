import { hasMarkedDescendants } from "./page-markers";

// The text of an element as a person reads it on the page. It is read from the text nodes and
// line breaks, not with innerText: innerText applies CSS text-transform, so a heading styled in
// capitals would be saved in capitals.

const LINE_BREAK = "\n";
const NO_BREAK_SPACE = /\u00a0/gu;
const SPACES_BUT_LINE_BREAKS = /[^\S\n]+/gu;
// HTML collapses only ASCII whitespace; a no-break space typed by a person stays.
const COLLAPSIBLE_WHITESPACE = /[\t\n\f\r ]+/gu;
const COLLAPSIBLE_SPACES = /[\t\f\r ]+/gu;
const SPACES_AROUND_LINE_BREAK = / *\n */gu;
const EDGE_WHITESPACE = /^[\n ]+|[\n ]+$/gu;

/** White-space values that keep line breaks of the text, and those that also keep its spaces. */
const KEEPS_LINE_BREAKS = new Set([
  "pre",
  "pre-wrap",
  "pre-line",
  "break-spaces",
]);
const KEEPS_SPACES = new Set(["pre", "pre-wrap", "break-spaces"]);

/** The text an element shows, with the line breaks it shows and without markup whitespace. */
export function readElementText(element: Element): string {
  const whiteSpace = whiteSpaceOf(element);
  const keepsLineBreaks = KEEPS_LINE_BREAKS.has(whiteSpace);
  const keepsSpaces = KEEPS_SPACES.has(whiteSpace);
  const collapsible = keepsLineBreaks
    ? COLLAPSIBLE_SPACES
    : COLLAPSIBLE_WHITESPACE;

  const pieces = textPieces(element).map((piece) =>
    piece.isLineBreak || keepsSpaces
      ? piece.text
      : piece.text.replace(collapsible, " "),
  );
  const joined = pieces.join("");
  const tidied = keepsSpaces
    ? joined
    : joined
        .replace(COLLAPSIBLE_SPACES, " ")
        .replace(SPACES_AROUND_LINE_BREAK, LINE_BREAK)
        .replace(EDGE_WHITESPACE, "");
  return tidied.replace(NO_BREAK_SPACE, " ");
}

/**
 * Text compared the way a person sees it: runs of spaces are one space, line breaks stay, since
 * a text that loses its line breaks on the page must not be edited there.
 */
export function normalizeSpaces(text: string): string {
  return text
    .replace(SPACES_BUT_LINE_BREAKS, " ")
    .replace(SPACES_AROUND_LINE_BREAK, LINE_BREAK)
    .trim();
}

/**
 * Whether the text of a field can be edited right in its element: the element shows the value
 * as it is (not formatted, not combined with other fields, with its line breaks) and holds no
 * other marked fields.
 */
export function canEditTextInPlace(element: Element, value: string): boolean {
  const shownText = normalizeSpaces(readElementText(element));
  const showsValueAsItIs = shownText === normalizeSpaces(value);
  return showsValueAsItIs && !hasMarkedDescendants(element);
}

interface TextPiece {
  readonly text: string;
  readonly isLineBreak: boolean;
}

function textPieces(element: Element): readonly TextPiece[] {
  const document = element.ownerDocument;
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  const pieces: TextPiece[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      pieces.push({ text: node.nodeValue ?? "", isLineBreak: false });
    } else if (node.nodeName === "BR") {
      pieces.push({ text: LINE_BREAK, isLineBreak: true });
    }
  }
  return pieces;
}

function whiteSpaceOf(element: Element): string {
  const view = element.ownerDocument.defaultView;
  return view === null ? "normal" : view.getComputedStyle(element).whiteSpace;
}
