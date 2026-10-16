// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineSchema, image, text } from "../schema";
import { connectToEditor } from "./connect-to-editor";
import {
  PROTOCOL_VERSION,
  type EditorMessage,
  type PageMessage,
} from "./messages";

const EDITOR_ORIGIN = "https://cms.example";
const schema = defineSchema({
  title: text({ label: "Заголовок" }),
  photo: image({ label: "Фото" }),
});

/** The window of the editor around the page's frame. */
const editor = {
  postMessage: vi.fn<(message: PageMessage, origin: string) => void>(),
};
let disconnect: () => void = () => undefined;

beforeEach(() => {
  document.body.innerHTML = `
    <h1 data-cms-path="title">Зерно</h1>
    <img data-cms-path="photo" alt="">
    <a href="/menu">Меню</a>`;
  editor.postMessage.mockReset();
  vi.spyOn(window, "parent", "get").mockReturnValue(
    editor as unknown as Window,
  );
});

afterEach(() => {
  disconnect();
  vi.restoreAllMocks();
});

function said(): PageMessage[] {
  return editor.postMessage.mock.calls.map(([message]) => message);
}

function say(message: EditorMessage, origin = EDITOR_ORIGIN): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: message,
      origin,
      source: editor as unknown as Window,
    }),
  );
}

function connect(): void {
  disconnect = connectToEditor({ editorOrigin: EDITOR_ORIGIN });
  say({ type: "connect", schema });
}

describe("connectToEditor", () => {
  it("tells the editor of its origin that the page is ready", () => {
    disconnect = connectToEditor({ editorOrigin: EDITOR_ORIGIN });

    expect(editor.postMessage).toHaveBeenCalledWith(
      { type: "ready", protocol: PROTOCOL_VERSION },
      EDITOR_ORIGIN,
    );
  });

  it("does nothing on a page that is not in a frame", () => {
    vi.spyOn(window, "parent", "get").mockReturnValue(window);

    disconnect = connectToEditor({ editorOrigin: EDITOR_ORIGIN });

    expect(editor.postMessage).not.toHaveBeenCalled();
  });

  it("reports where the marked elements are once the editor connects", () => {
    connect();

    expect(said().map((message) => message.type)).toEqual(["ready", "layout"]);
  });

  it("listens to no one but the editor", () => {
    disconnect = connectToEditor({ editorOrigin: EDITOR_ORIGIN });

    say({ type: "connect", schema }, "https://evil.example");

    expect(said()).toEqual([{ type: "ready", protocol: PROTOCOL_VERSION }]);
  });

  it("reports clicks, links and shortcuts and keeps the page from acting on them", () => {
    connect();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    const save = new KeyboardEvent("keydown", {
      code: "KeyS",
      ctrlKey: true,
      cancelable: true,
    });

    document.querySelector("h1")?.dispatchEvent(click);
    document
      .querySelector("a")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.dispatchEvent(save);

    expect(click.defaultPrevented).toBe(true);
    expect(save.defaultPrevented).toBe(true);
    expect(said().slice(2)).toEqual([
      { type: "click", target: { path: "title", point: { x: 0, y: 0 } } },
      { type: "link-click", href: "/menu" },
      { type: "key", key: "save" },
    ]);
  });

  it("lets only a photo take a dragged file", () => {
    connect();
    const overTitle = fileDrag();
    const overPhoto = fileDrag();

    document.querySelector("h1")?.dispatchEvent(overTitle);
    document.querySelector("img")?.dispatchEvent(overPhoto);

    expect(overTitle.dataTransfer.dropEffect).toBe("none");
    expect(overPhoto.dataTransfer.dropEffect).toBe("copy");
    expect(said().slice(2)).toEqual([
      { type: "file-drag", path: undefined },
      { type: "file-drag", path: "photo" },
    ]);
  });

  it("types a field the editor asks for", () => {
    connect();

    say({
      type: "start-typing",
      path: "title",
      text: "Зерно",
      isSingleLine: true,
      point: { x: 0, y: 0 },
    });

    expect(said().at(-1)).toEqual({ type: "typing-started", path: "title" });
    expect(document.querySelector("h1")?.getAttribute("contenteditable")).toBe(
      "plaintext-only",
    );
  });
});

function fileDrag(): Event & { dataTransfer: { dropEffect: string } } {
  const event = new Event("dragover", { bubbles: true, cancelable: true });
  const dataTransfer = { types: ["Files"], files: [], dropEffect: "none" };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event as Event & { dataTransfer: typeof dataTransfer };
}
