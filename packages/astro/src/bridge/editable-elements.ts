// The one way the bridge makes an element of the page editable and gives it back. A focused
// editable element gets the browser's focus ring (Chrome draws it black or blue), while the editor
// already outlines the field over the frame: two rings around one text. The ring is taken off for
// as long as the element is editable, and its own outline comes back after.

const OUTLINE = "outline";
const NO_OUTLINE = "none";
const IMPORTANT = "important";

interface KeptOutline {
  readonly value: string;
  readonly priority: string;
}

const keptOutlines = new WeakMap<HTMLElement, KeptOutline>();

/** Makes the element editable as `editable` says (`plaintext-only` or `true`), without a focus ring. */
export function makeEditable(element: HTMLElement, editable: string): void {
  element.setAttribute("contenteditable", editable);
  if (keptOutlines.has(element)) return;

  // Set through the CSS object model: a site's policy may refuse style attributes, never this.
  const { style } = element;
  keptOutlines.set(element, {
    value: style.getPropertyValue(OUTLINE),
    priority: style.getPropertyPriority(OUTLINE),
  });
  style.setProperty(OUTLINE, NO_OUTLINE, IMPORTANT);
}

/** Makes the element as it was before `makeEditable`. */
export function makeUneditable(element: HTMLElement): void {
  element.removeAttribute("contenteditable");
  const kept = keptOutlines.get(element);
  if (kept === undefined) return;

  keptOutlines.delete(element);
  restoreOutline(element, kept);
}

function restoreOutline(element: HTMLElement, kept: KeptOutline): void {
  const { style } = element;
  if (kept.value === "") {
    style.removeProperty(OUTLINE);
  } else {
    style.setProperty(OUTLINE, kept.value, kept.priority);
  }
  if (style.length === 0) element.removeAttribute("style");
}
