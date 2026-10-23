import { FIELD_PATH_ATTRIBUTE } from "../schema";
import { asElement } from "./dom-nodes";

// The texts of the page the site's code writes: words in no marked element, the site's own
// (`data-cms-fixed`) or left unmarked. The editor outlines them when the pointer is over them and
// says that a developer changes them, so a click on them never passes in silence.

const MARKER_SELECTOR = `[${FIELD_PATH_ATTRIBUTE}]`;
/** A text with a letter or a digit: a lone `·` or `→` is a part of the design, not words. */
const WORDS = /[\p{L}\p{N}]/u;

/**
 * The element whose own words the target is, when they stand outside every marked element and
 * outside a text being typed; undefined for a target without words of its own (the empty space of
 * a block) or in a field.
 */
export function staticTextAround(
  target: EventTarget | null,
): Element | undefined {
  const element = asElement(target);
  if (element === undefined) return undefined;

  const isInField = element.closest(MARKER_SELECTOR) !== null;
  const isTyped = element.closest("[contenteditable]") !== null;
  if (isInField || isTyped || !hasOwnWords(element)) return undefined;
  return element;
}

function hasOwnWords(element: Element): boolean {
  return [...element.childNodes].some(
    (node) =>
      node.nodeType === Node.TEXT_NODE && WORDS.test(node.nodeValue ?? ""),
  );
}
