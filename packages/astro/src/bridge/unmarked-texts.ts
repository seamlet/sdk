import { FIELD_PATH_ATTRIBUTE, FIXED_TEXT_ATTRIBUTE } from "../schema";

// The texts of a page the CMS's editor cannot reach: words a visitor reads that stand in no element
// marked with a field's path, so a click on them does nothing in the editor. The check reads a page
// as plain nodes, so it runs on the preview in the browser and on the HTML of a build alike.

/** A node of a page as the check reads it: an element with its attributes, or a text. */
export type PageNode = PageElement | PageText;

export interface PageElement {
  readonly kind: "element";
  /** The element's name in lower case: `h2`, `a`. */
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly PageNode[];
}

export interface PageText {
  readonly kind: "text";
  readonly text: string;
}

/** A text a visitor reads that no field holds, and the elements it stands in. */
export interface UnmarkedText {
  /** The words with their spaces collapsed. */
  readonly text: string;
  /** The closest elements around it, the outermost first: `footer > nav > a.footer-link`. */
  readonly location: string;
}

/**
 * Elements whose words a visitor does not read on the page, or reads as a control draws them: what
 * runs, styles and templates, the head, the options of a list, the words of a text area.
 */
const UNREAD_ELEMENTS: ReadonlySet<string> = new Set([
  "script",
  "style",
  "template",
  "noscript",
  "head",
  "title",
  "desc",
  "select",
  "option",
  "optgroup",
  "datalist",
  "textarea",
]);
/** How many of the elements around a text its location names. */
const LOCATION_DEPTH = 3;
/** The classes Astro gives an element to scope its styles: they name no part of the page. */
const SCOPED_STYLE_CLASS = /^astro-/u;
/** A text with a letter or a digit: a lone `·` or `→` is a part of the design, not words. */
const WORDS = /[\p{L}\p{N}]/u;
const SPACES = /\s+/gu;

/** Every text of the page under the root that no marked element holds, each once per place. */
export function unmarkedTextsOf(root: PageNode): UnmarkedText[] {
  const found = new Map<string, UnmarkedText>();
  collectUnmarkedTexts(root, [], (unmarked) => {
    found.set(`${unmarked.location}\n${unmarked.text}`, unmarked);
  });
  return [...found.values()];
}

/** The text and its place as one line of a report: `«Каталог» in header > nav > a`. */
export function describeUnmarkedText(unmarked: UnmarkedText): string {
  return `«${unmarked.text}» in ${unmarked.location}`;
}

function collectUnmarkedTexts(
  node: PageNode,
  around: readonly string[],
  collect: (unmarked: UnmarkedText) => void,
): void {
  if (node.kind === "text") {
    collectText(node, around, collect);
    return;
  }
  if (isReachedOrUnread(node)) return;

  const inside = [...around, describeElement(node)];
  for (const child of node.children) {
    collectUnmarkedTexts(child, inside, collect);
  }
}

function collectText(
  node: PageText,
  around: readonly string[],
  collect: (unmarked: UnmarkedText) => void,
): void {
  const text = node.text.replace(SPACES, " ").trim();
  if (!WORDS.test(text)) return;

  const location = around.slice(-LOCATION_DEPTH).join(" > ");
  collect({ text, location });
}

/**
 * Whether the editor reaches the element's texts (a field's marker), the site gave them to its code
 * (`data-cms-fixed`), or a visitor does not read them: hidden, or hidden from screen readers as a
 * decoration that repeats what is said nearby.
 */
function isReachedOrUnread(element: PageElement): boolean {
  const { attributes } = element;
  const isMarked = Object.hasOwn(attributes, FIELD_PATH_ATTRIBUTE);
  const isFixed = Object.hasOwn(attributes, FIXED_TEXT_ATTRIBUTE);
  const isHidden = Object.hasOwn(attributes, "hidden");
  const isDecoration = attributes["aria-hidden"] === "true";
  const isUnread = UNREAD_ELEMENTS.has(element.name);
  return isMarked || isFixed || isHidden || isDecoration || isUnread;
}

/** `a.footer-link`: the element's name and its first class of the site's own. */
function describeElement(element: PageElement): string {
  const classes = (element.attributes.class ?? "").split(SPACES);
  const ownClass = classes.find(
    (name) => name !== "" && !SCOPED_STYLE_CLASS.test(name),
  );
  return ownClass === undefined ? element.name : `${element.name}.${ownClass}`;
}
