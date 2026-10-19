// What a node of the page is, told by its shape, not with instanceof: the classes are those of the
// bridge's window, and a page driven from another window (a test drives a frame) has classes of its
// own.

/** The value as an element, or undefined when it is not one (a text node, the document, nothing). */
export function asElement(value: unknown): Element | undefined {
  const isElement =
    typeof value === "object" &&
    value !== null &&
    "nodeType" in value &&
    value.nodeType === Node.ELEMENT_NODE;
  return isElement ? (value as Element) : undefined;
}
