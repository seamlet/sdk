import {
  formatFieldPath,
  resolveFieldPath,
  type FieldPath,
  type Fields,
} from "../schema";
import { readElementText } from "./element-text";
import { fieldStepOf, shortcutOf } from "./editor-shortcuts";
import { holdMotionOnPage, isEditedInPopover } from "./held-motion";
import { imageFieldAt } from "./image-fields";
import { typedKindAt } from "./typed-fields";
import {
  PROTOCOL_VERSION,
  readEditorMessage,
  type EditorKey,
  type EditorMessage,
  type PageMessage,
} from "./messages";
import {
  listenToPage,
  type PageListeners,
  type PagePointer,
} from "./page-events";
import { createLayoutReports, type LayoutReports } from "./page-layout";
import {
  copyOf,
  findClosestMarkedElement,
  hasMarkedDescendants,
  markedCopyOf,
} from "./page-markers";
import { revealAround } from "./page-reveals";
import { followPresses } from "./page-presses";
import { warnAboutUnreachableFields } from "./page-checks";
import { createPageRenderer, type PageRenderer } from "./page-rendering";
import { createPageTyping, type PageTyping } from "./page-typing";

// The bridge between a site's page and the CMS's editor. A site puts it on its preview: the editor
// shows the preview in a frame and draws over it in its own document, while the bridge tells it
// where the marked elements are and what a person does on the page, and shows the editor's draft.

export interface BridgeOptions {
  /** The origin of the CMS whose editor may frame the page, such as `https://cms.example.com`. */
  readonly editorOrigin: string;
}

/** Waits for the editor when the page is in its frame; does nothing elsewhere. Returns a stop. */
export function connectToEditor(options: BridgeOptions): () => void {
  const editor = window.parent;
  const isFramed = editor !== window;
  if (!isFramed) return () => undefined;

  const send = (message: PageMessage) => {
    editor.postMessage(message, options.editorOrigin);
  };
  let connection: EditorConnection | undefined;

  const receive = (event: MessageEvent) => {
    const isFromEditor =
      event.source === editor && event.origin === options.editorOrigin;
    const message = isFromEditor ? readEditorMessage(event.data) : undefined;
    if (message === undefined) return;

    if (message.type === "connect") {
      connection?.stop();
      connection = connectPage(document, message.schema, send);
      return;
    }
    connection?.receive(message);
  };

  window.addEventListener("message", receive);
  send({ type: "ready", protocol: PROTOCOL_VERSION });
  const stopChecks = warnAboutUnreachableFields(document);
  return () => {
    stopChecks();
    window.removeEventListener("message", receive);
    connection?.stop();
  };
}

interface EditorConnection {
  readonly receive: (message: EditorMessage) => void;
  readonly stop: () => void;
}

/** What the page does for the editor once it connected. */
export function connectPage(
  document: Document,
  schema: Fields,
  send: (message: PageMessage) => void,
): EditorConnection {
  const layout = createLayoutReports(document, {
    onLayout: (measured) => {
      send({ type: "layout", layout: measured });
    },
    onStaticText: (box) => {
      send({ type: "static-hover", box });
    },
  });
  const showHeldPage = () => {
    renderer.showHeldPage();
  };
  const typing = createPageTyping({
    document,
    send,
    onInput: layout.schedule,
    onTypingOver: showHeldPage,
  });
  const presses = followPresses(document, showHeldPage);
  const motion = holdMotionOnPage(document);
  const renderer = createPageRenderer({
    document,
    // Replacing the page under a text being typed would throw the typing away.
    canReplacePage: () => !typing.isTyping(),
    isPagePressed: presses.isPressed,
    onRendered: () => {
      motion.holdAgain();
      layout.reportNow();
      send({ type: "rendered" });
    },
    onFailed: (error) => {
      console.error(error);
      send({ type: "render-failed" });
    },
  });

  const page: ConnectedPage = {
    document,
    schema,
    send,
    layout,
    typing,
    renderer,
  };
  const stopListening = listenToPage(document, pageListenersOf(page));
  layout.reportNow();

  return {
    receive: (message) => {
      receiveEditorMessage(page, message);
    },
    stop: () => {
      typing.stop();
      renderer.stop();
      presses.stop();
      motion.stop();
      layout.stop();
      stopListening();
    },
  };
}

/** What a connected page is made of. */
interface ConnectedPage {
  readonly document: Document;
  readonly schema: Fields;
  readonly send: (message: PageMessage) => void;
  readonly layout: LayoutReports;
  readonly typing: PageTyping;
  readonly renderer: PageRenderer;
}

/** What the page tells the editor of what a person does on it. */
function pageListenersOf(page: ConnectedPage): PageListeners {
  const { schema, send, layout } = page;
  return {
    onHover: (marked) => {
      send(
        marked === undefined
          ? { type: "hover", path: undefined }
          : { type: "hover", path: marked.path, copy: copyOf(marked) },
      );
    },
    onClick: (pointer) => {
      clickOn(page, pointer);
    },
    onClickOutside: (text) => {
      send({
        type: "click",
        target: undefined,
        isStaticText: text !== undefined,
      });
    },
    onStaticTextHover: layout.hoverStaticText,
    onLinkHover: layout.hoverLink,
    onLinkClick: (link) => {
      send({ type: "link-click", href: link.href });
    },
    onKeyDown: (event) => {
      pressKey(page, event);
    },
    onFileDragOver: (path) => {
      const isTaken = imageFieldAt(schema, path) !== undefined;
      send({ type: "file-drag", path: isTaken ? path : undefined });
      return isTaken;
    },
    onFileDragEnd: () => {
      send({ type: "file-drag-end" });
    },
    onFileDrop: (path, file) => {
      const isTaken = imageFieldAt(schema, path) !== undefined;
      if (isTaken) send({ type: "file-drop", path, file });
    },
    onLayoutChange: layout.schedule,
  };
}

/** A click on a field makes its text ready to be typed, at once, while the tap gives the focus. */
function clickOn(page: ConnectedPage, pointer: PagePointer): void {
  const { path, element, point } = pointer;
  const kind = typedKindAt(page.schema, path);
  const canBeTyped = kind !== undefined && !isEditedInPopover(element);
  if (canBeTyped) page.typing.prepare(element, kind);

  const shownText = shownTextOf(page.schema, pointer);
  page.send({ type: "click", target: { path, point, shownText } });
}

/**
 * The words a field's element shows, when it shows one field alone: the editor tells by them a
 * field the site shows otherwise than its value. None for a record, a group or a list.
 */
function shownTextOf(schema: Fields, pointer: PagePointer): string | undefined {
  const target = resolveFieldPath(schema, pointer.path);
  const isField =
    target?.kind === "field" &&
    target.field.kind !== "group" &&
    target.field.kind !== "collection";
  if (!isField || hasMarkedDescendants(pointer.element)) return undefined;

  const words = readElementText(pointer.element);
  return words === "" ? undefined : words;
}

function pressKey(page: ConnectedPage, event: KeyboardEvent): void {
  const isTyping = page.typing.isTyping();
  const key = editorKeyOf(event, isTyping);
  // While a text is typed, Escape belongs to the typing: it ends it, keeping what was typed.
  const isTypingEscape = key === "escape" && isTyping;
  if (key === undefined || isTypingEscape) return;

  event.preventDefault();
  page.typing.stop();
  page.send({ type: "key", key });
}

function receiveEditorMessage(
  page: ConnectedPage,
  message: EditorMessage,
): void {
  const { typing } = page;
  switch (message.type) {
    case "connect":
      break;
    case "render":
      page.renderer.render(message.content);
      break;
    case "start-typing":
      typing.start(message);
      break;
    case "start-rich-typing":
      typing.startRich(message);
      break;
    case "start-value-typing":
      typing.startValue(message);
      break;
    case "format-typed":
      typing.format(message.format);
      break;
    case "link-typed":
      typing.setLink(message.href);
      break;
    case "stop-typing":
      typing.stop();
      break;
    case "scroll-to":
      scrollToField(page.document, message);
      break;
  }
}

/**
 * Shows the field the editor chose, the copy it names when the page shows the field more than
 * once: opens what hides it, then scrolls to it.
 */
function scrollToField(
  document: Document,
  target: { readonly path: FieldPath; readonly copy?: number },
): void {
  const named =
    target.copy === undefined
      ? undefined
      : markedCopyOf(document, formatFieldPath(target.path), target.copy);
  const element = named ?? findClosestMarkedElement(document, target.path);
  if (element === undefined) return;

  revealAround(element);
  element.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/** The key the editor acts on; Tab only while a text is typed, elsewhere it moves the focus. */
function editorKeyOf(
  event: KeyboardEvent,
  isTyping: boolean,
): EditorKey | undefined {
  if (event.key === "Escape") return "escape";
  if (isTyping) return fieldStepOf(event) ?? shortcutOf(event);
  return shortcutOf(event);
}
