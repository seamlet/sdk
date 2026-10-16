import type { Content, FieldPath, Fields } from "../schema";
import type { Box, Viewport } from "./boxes";
import type { Shortcut } from "./editor-shortcuts";
import type { InlineEditingOutcome } from "./inline-text-editing";

// What the editor and the site's page say to each other. The page lives on the site's own origin,
// in a frame of the editor, so the two talk only with postMessage. Each side reads what it gets
// back into these types and drops anything else.

/**
 * The version of what the two say to each other. A site updates @seamlet/astro when it likes, so the
 * editor may meet a bridge of another version: it tells by this number, said with `ready`, instead
 * of misreading the page. Raised whenever a message changes in a way the other side cannot read.
 */
export const PROTOCOL_VERSION = 1;

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

/** A key the editor acts on: its shortcuts, and Escape that closes what is open. */
export type EditorKey = Shortcut | "escape";

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
  | { readonly type: "stop-typing" }
  /** Bring the field, or the closest marked element around it, into view. */
  | { readonly type: "scroll-to"; readonly path: FieldPath };

const EDITOR_KEYS: ReadonlySet<string> = new Set<EditorKey>([
  "save",
  "undo",
  "redo",
  "escape",
]);
const TYPING_OUTCOMES: ReadonlySet<string> = new Set<InlineEditingOutcome>([
  "kept",
  "reverted",
]);

/** The message the page sent, or undefined for anything that is not one. */
export function readPageMessage(data: unknown): PageMessage | undefined {
  if (!isRecord(data)) return undefined;
  return isPageMessage(data) ? data : undefined;
}

/** The message the editor sent, or undefined for anything that is not one. */
export function readEditorMessage(data: unknown): EditorMessage | undefined {
  if (!isRecord(data)) return undefined;
  return isEditorMessage(data) ? data : undefined;
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
