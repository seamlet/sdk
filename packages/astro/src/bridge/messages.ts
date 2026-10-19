import {
  readRichText,
  type Content,
  type FieldPath,
  type Fields,
  type RichText,
} from "../schema";
import type { Box, Viewport } from "./boxes";

// What the editor and the site's page say to each other. The page lives on the site's own origin,
// in a frame of the editor, so the two talk only with postMessage. Each side reads what it gets
// back into these types and drops anything else.

/**
 * The version of what the two say to each other. A site updates @seamlet/astro when it likes, so the
 * editor may meet a bridge of another version: it tells by this number, said with `ready`, instead
 * of misreading the page. Raised whenever a message changes in a way the other side cannot read.
 */
export const PROTOCOL_VERSION = 2;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A marked element of the page and where it is. */
export interface MarkerBox {
  readonly path: string;
  readonly box: Box;
}

/** A link on the page that is not a field. */
export interface LinkBox {
  /** The address as the site wrote it. */
  readonly href: string;
  readonly box: Box;
}

/** Where everything the editor draws over is on the page now. */
export interface PageLayout {
  /** Every marked element that takes space, in the order of the page. */
  readonly markers: readonly MarkerBox[];
  readonly viewport: Viewport;
  /** The link under the pointer, if it is not a field. */
  readonly link: LinkBox | undefined;
}

const SHORTCUTS = ["save", "undo", "redo"] as const;
const EDITOR_KEY_NAMES = [...SHORTCUTS, "escape"] as const;
const TEXT_FORMAT_NAMES = ["bold", "italic", "list"] as const;
const TYPING_OUTCOME_NAMES = ["kept", "reverted"] as const;

/** A keyboard shortcut of the editor, pressed on the page. */
export type Shortcut = (typeof SHORTCUTS)[number];

/** A key the editor acts on: its shortcuts, and Escape that closes what is open. */
export type EditorKey = (typeof EDITOR_KEY_NAMES)[number];

/** A change of formatting the editor's toolbar asks for. */
export type TextFormat = (typeof TEXT_FORMAT_NAMES)[number];

/** How a typing in place ended: the typed text kept, or brought back as it was. */
export type InlineEditingOutcome = (typeof TYPING_OUTCOME_NAMES)[number];

/** The marks of the selected words of a formatted text. */
export interface TextFormats {
  readonly isBold: boolean;
  readonly isItalic: boolean;
  readonly isList: boolean;
  /** The address of the link the selection is in, when all of it is in one link. */
  readonly href: string | undefined;
}

/** The selection in the typed text: where it is on the page and what its words have. */
export interface TypedSelection {
  readonly box: Box;
  readonly isCollapsed: boolean;
  readonly formats: TextFormats;
}

/** What the page tells the editor. */
export type PageMessage =
  /** The bridge runs and waits for the editor to connect; it speaks this version of the protocol. */
  | { readonly type: "ready"; readonly protocol: number }
  | { readonly type: "layout"; readonly layout: PageLayout }
  /** The pointer moved onto a marked element, or off all of them. */
  | { readonly type: "hover"; readonly path: string | undefined }
  /** A click on a marked element, or outside all of them. */
  | {
      readonly type: "click";
      readonly target:
        { readonly path: string; readonly point: Point } | undefined;
    }
  | { readonly type: "link-click"; readonly href: string }
  | { readonly type: "key"; readonly key: EditorKey }
  /** A file is dragged over the page: over a photo that takes it, or elsewhere. */
  | { readonly type: "file-drag"; readonly path: string | undefined }
  | { readonly type: "file-drag-end" }
  | { readonly type: "file-drop"; readonly path: string; readonly file: File }
  | { readonly type: "typing-started"; readonly path: string }
  /** The element does not show the text as it is: the field is edited in a popover. */
  | { readonly type: "typing-refused"; readonly path: string }
  | { readonly type: "typed"; readonly path: string; readonly text: string }
  /** The formatted text typed in place, after every character and every change of its marks. */
  | {
      readonly type: "rich-typed";
      readonly path: string;
      readonly text: RichText;
    }
  /** Where the selection in the typed formatted text is now, for the editor's toolbar. */
  | {
      readonly type: "typed-selection";
      readonly path: string;
      readonly selection: TypedSelection | undefined;
    }
  | {
      readonly type: "typing-ended";
      readonly path: string;
      readonly outcome: InlineEditingOutcome;
    }
  | { readonly type: "rendered" }
  | { readonly type: "render-failed" };

/** What the editor tells the page. */
export type EditorMessage =
  /** The editor took the page; the schema tells the bridge which fields take a photo. */
  | { readonly type: "connect"; readonly schema: Fields }
  /** Show the page with this content. */
  | { readonly type: "render"; readonly content: Content }
  /** Type the text of the field right in its element, if the element shows it as it is. */
  | {
      readonly type: "start-typing";
      readonly path: string;
      readonly text: string;
      readonly isSingleLine: boolean;
      readonly point: Point;
    }
  /** Type the formatted text of the field in its element, if the element shows it as it is. */
  | {
      readonly type: "start-rich-typing";
      readonly path: string;
      readonly text: RichText;
      /** The words alone, in an element of one line. */
      readonly isInline: boolean;
      readonly point: Point;
    }
  /** Mark the selected words of the formatted text typed in place, or make its lines a list. */
  | { readonly type: "format-typed"; readonly format: TextFormat }
  /** The selected words of the typed text, or the link at the cursor, lead here, or nowhere. */
  | { readonly type: "link-typed"; readonly href: string | undefined }
  | { readonly type: "stop-typing" }
  /** Bring the field, or the closest marked element around it, into view. */
  | { readonly type: "scroll-to"; readonly path: FieldPath };

const EDITOR_KEYS: ReadonlySet<string> = new Set(EDITOR_KEY_NAMES);
const TEXT_FORMATS: ReadonlySet<string> = new Set(TEXT_FORMAT_NAMES);
const TYPING_OUTCOMES: ReadonlySet<string> = new Set(TYPING_OUTCOME_NAMES);

/** The message the page sent, or undefined for anything that is not one. */
export function readPageMessage(posted: unknown): PageMessage | undefined {
  if (!isRecord(posted)) return undefined;
  return isPageMessage(posted) ? posted : undefined;
}

/** The message the editor sent, or undefined for anything that is not one. */
export function readEditorMessage(posted: unknown): EditorMessage | undefined {
  if (!isRecord(posted)) return undefined;
  return isEditorMessage(posted) ? posted : undefined;
}

type MessageRecord = Readonly<Record<string, unknown>>;

function isPageMessage(message: MessageRecord): message is PageMessage {
  switch (message["type"]) {
    case "ready":
      return isNumber(message["protocol"]);
    case "file-drag-end":
    case "rendered":
    case "render-failed":
      return true;
    case "layout":
      return isLayout(message["layout"]);
    case "hover":
    case "file-drag":
      return isOptional(message["path"], isString);
    case "click":
      return isOptional(message["target"], isClickTarget);
    case "link-click":
      return isString(message["href"]);
    case "key":
      return isString(message["key"]) && EDITOR_KEYS.has(message["key"]);
    case "file-drop":
      return isString(message["path"]) && message["file"] instanceof File;
    case "typing-started":
    case "typing-refused":
      return isString(message["path"]);
    case "typed":
      return isString(message["path"]) && isString(message["text"]);
    case "rich-typed":
      return isString(message["path"]) && isRichText(message["text"]);
    case "typed-selection":
      return (
        isString(message["path"]) &&
        isOptional(message["selection"], isTypedSelection)
      );
    case "typing-ended":
      return (
        isString(message["path"]) &&
        isString(message["outcome"]) &&
        TYPING_OUTCOMES.has(message["outcome"])
      );
    default:
      return false;
  }
}

function isEditorMessage(message: MessageRecord): message is EditorMessage {
  switch (message["type"]) {
    case "connect":
      return isRecord(message["schema"]);
    case "render":
      return isRecord(message["content"]);
    case "start-typing":
      return (
        isString(message["path"]) &&
        isString(message["text"]) &&
        typeof message["isSingleLine"] === "boolean" &&
        isPoint(message["point"])
      );
    case "start-rich-typing":
      return (
        isString(message["path"]) &&
        isRichText(message["text"]) &&
        typeof message["isInline"] === "boolean" &&
        isPoint(message["point"])
      );
    case "format-typed":
      return isString(message["format"]) && TEXT_FORMATS.has(message["format"]);
    case "link-typed":
      return isOptional(message["href"], isString);
    case "stop-typing":
      return true;
    case "scroll-to":
      return isFieldPath(message["path"]);
    default:
      return false;
  }
}

function isLayout(value: unknown): value is PageLayout {
  if (!isRecord(value)) return false;
  const markers = value["markers"];
  return (
    Array.isArray(markers) &&
    markers.every(isMarkerBox) &&
    isViewport(value["viewport"]) &&
    isOptional(value["link"], isLinkBox)
  );
}

function isMarkerBox(value: unknown): value is MarkerBox {
  return isRecord(value) && isString(value["path"]) && isBox(value["box"]);
}

function isLinkBox(value: unknown): value is LinkBox {
  return isRecord(value) && isString(value["href"]) && isBox(value["box"]);
}

function isClickTarget(value: unknown): boolean {
  return isRecord(value) && isString(value["path"]) && isPoint(value["point"]);
}

function isRichText(value: unknown): value is RichText {
  return readRichText(value) !== undefined;
}

function isTypedSelection(value: unknown): value is TypedSelection {
  return (
    isRecord(value) &&
    isBox(value["box"]) &&
    typeof value["isCollapsed"] === "boolean" &&
    isTextFormats(value["formats"])
  );
}

function isTextFormats(value: unknown): value is TextFormats {
  return (
    isRecord(value) &&
    typeof value["isBold"] === "boolean" &&
    typeof value["isItalic"] === "boolean" &&
    typeof value["isList"] === "boolean" &&
    isOptional(value["href"], isString)
  );
}

function isBox(value: unknown): value is Box {
  return (
    isRecord(value) &&
    isNumber(value["top"]) &&
    isNumber(value["left"]) &&
    isNumber(value["width"]) &&
    isNumber(value["height"])
  );
}

function isViewport(value: unknown): value is Viewport {
  return (
    isRecord(value) && isNumber(value["width"]) && isNumber(value["height"])
  );
}

function isPoint(value: unknown): value is Point {
  return isRecord(value) && isNumber(value["x"]) && isNumber(value["y"]);
}

function isFieldPath(value: unknown): value is FieldPath {
  return (
    Array.isArray(value) &&
    value.every((segment) => isString(segment) || isNumber(segment))
  );
}

function isOptional(
  value: unknown,
  isPresent: (value: unknown) => boolean,
): boolean {
  return value === undefined || isPresent(value);
}

function isRecord(value: unknown): value is MessageRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
