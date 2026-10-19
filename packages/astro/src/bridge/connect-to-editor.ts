import type { FieldPath, Fields } from "../schema";
import { shortcutOf } from "./editor-shortcuts";
import { imageFieldAt } from "./image-fields";
import { typedKindAt } from "./typed-fields";
import {
  PROTOCOL_VERSION,
  readEditorMessage,
  type EditorKey,
  type EditorMessage,
  type PageMessage,
} from "./messages";
import { listenToPage } from "./page-events";
import { createLayoutReports } from "./page-layout";
import { findClosestMarkedElement } from "./page-markers";
import { revealAround } from "./page-reveals";
import { followPresses } from "./page-presses";
import { createPageRenderer } from "./page-rendering";
import { createPageTyping } from "./page-typing";

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
  return () => {
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
  const layout = createLayoutReports(document, (measured) => {
    send({ type: "layout", layout: measured });
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
  const renderer = createPageRenderer({
    document,
    // Replacing the page under a text being typed would throw the typing away.
    canReplacePage: () => !typing.isTyping(),
    isPagePressed: presses.isPressed,
    onRendered: () => {
      layout.reportNow();
      send({ type: "rendered" });
    },
    onFailed: (error) => {
      console.error(error);
      send({ type: "render-failed" });
    },
  });

  const pressKey = (event: KeyboardEvent) => {
    const key = editorKeyOf(event);
    // While a text is typed, Escape belongs to the typing: it brings the text back.
    const isTypingEscape = key === "escape" && typing.isTyping();
    if (key === undefined || isTypingEscape) return;

    event.preventDefault();
    typing.stop();
    send({ type: "key", key });
  };

  const stopListening = listenToPage(document, {
    onHover: (path) => {
      send({ type: "hover", path });
    },
    onClick: (pointer) => {
      const kind =
        pointer === undefined ? undefined : typedKindAt(schema, pointer.path);
      if (pointer !== undefined && kind !== undefined) {
        typing.prepare(pointer.element, kind);
      }
      const target =
        pointer === undefined
          ? undefined
          : { path: pointer.path, point: pointer.point };
      send({ type: "click", target });
    },
    onLinkHover: layout.hoverLink,
    onLinkClick: (link) => {
      send({ type: "link-click", href: link.href });
    },
    onKeyDown: pressKey,
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
  });
  layout.reportNow();

  const receive = (message: EditorMessage) => {
    switch (message.type) {
      case "connect":
        break;
      case "render":
        renderer.render(message.content);
        break;
      case "start-typing":
        typing.start(message);
        break;
      case "start-rich-typing":
        typing.startRich(message);
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
        scrollToField(document, message.path);
        break;
    }
  };

  return {
    receive,
    stop: () => {
      typing.stop();
      renderer.stop();
      presses.stop();
      layout.stop();
      stopListening();
    },
  };
}

/** Shows the field the editor chose: opens what hides it, then scrolls to it. */
function scrollToField(document: Document, path: FieldPath): void {
  const element = findClosestMarkedElement(document, path);
  if (element === undefined) return;

  revealAround(element);
  element.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function editorKeyOf(event: KeyboardEvent): EditorKey | undefined {
  if (event.key === "Escape") return "escape";
  return shortcutOf(event);
}
