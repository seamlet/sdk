import { asOneParagraph, type RichText } from "../schema";
import {
  readRichTextFrom,
  renderInlineRichText,
  renderRichText,
} from "./rich-text-dom";

// How a formatted text stands in the element that shows it: paragraphs and lists, or the words
// alone in an element of one line (`<h1>`), as `RichText` renders it with `inline`. The one place
// that tells the two apart; typing takes everything that differs from here.

export interface RichTextLayout {
  /** The text as the element can show it. */
  readonly shapeOf: (text: RichText) => RichText;
  /** What the element holds now, as formatted text. */
  readonly read: (element: HTMLElement) => RichText;
  /** Puts the text into the element in place of what it held. */
  readonly render: (element: HTMLElement, text: RichText) => void;
  readonly canHoldLists: boolean;
  /** Whether the key ends the typing and keeps the text. */
  readonly isEndingKey: (event: KeyboardEvent) => boolean;
  /** The words of a pasted text as the element takes them. */
  readonly pastedWords: (pasted: string) => string;
}

const PASTED_LINE_BREAKS = /\s*\n\s*/gu;
const SPACE = " ";

const BLOCKS_LAYOUT: RichTextLayout = {
  shapeOf: (text) => text,
  read: readRichTextFrom,
  render: renderRichText,
  canHoldLists: true,
  isEndingKey: () => false,
  pastedWords: (pasted) => pasted,
};

const LINE_LAYOUT: RichTextLayout = {
  shapeOf: asOneParagraph,
  read: (element) => asOneParagraph(readRichTextFrom(element)),
  render: renderInlineRichText,
  canHoldLists: false,
  isEndingKey: (event) => event.key === "Enter" && !event.shiftKey,
  pastedWords: (pasted) => pasted.replace(PASTED_LINE_BREAKS, SPACE),
};

/** The layout of a text: the words alone (`inline`) or paragraphs and lists. */
export function richTextLayoutOf(isInline: boolean): RichTextLayout {
  return isInline ? LINE_LAYOUT : BLOCKS_LAYOUT;
}
