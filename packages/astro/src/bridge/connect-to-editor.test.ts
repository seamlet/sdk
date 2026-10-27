// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collection, defineSchema, image, link, number, text } from "../schema";
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
  menu: collection({
    label: "Меню",
    item: {
      name: link({ label: "Название" }),
      price: number({ label: "Цена" }),
    },
  }),
});

/** The window of the editor around the page's frame. */
const editor = {
  postMessage: vi.fn<(message: PageMessage, origin: string) => void>(),
};
let disconnect: () => void = () => undefined;

beforeEach(() => {
  document.body.innerHTML = `
    <h1 data-cms-path="title">Кофейня</h1>
    <img data-cms-path="photo" alt="">
    <a href="/menu">Меню</a>
    <p id="pickup" data-cms-fixed>Самовывоз</p>
    <div id="empty"></div>`;
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

  it("ignores every message of another origin or another window, once connected", () => {
    connect();
    const fetchPage = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchPage);
    const messages: readonly EditorMessage[] = [
      { type: "connect", schema },
      { type: "render", content: { title: "Чужое" } },
      {
        type: "start-typing",
        path: "title",
        text: "Кофейня",
        isSingleLine: true,
        point: { x: 0, y: 0 },
      },
      {
        type: "start-rich-typing",
        path: "title",
        text: [],
        isInline: true,
        point: { x: 0, y: 0 },
      },
      { type: "format-typed", format: "bold" },
      { type: "link-typed", href: "/menu" },
      { type: "stop-typing" },
      { type: "scroll-to", path: ["title"] },
      {
        type: "start-value-typing",
        path: "title",
        kind: "number",
        value: 1,
      },
    ];

    for (const message of messages) {
      say(message, "https://evil.example");
      window.dispatchEvent(
        new MessageEvent("message", {
          data: message,
          origin: EDITOR_ORIGIN,
          source: window,
        }),
      );
    }

    expect(said().map((message) => message.type)).toEqual(["ready", "layout"]);
    expect(fetchPage).not.toHaveBeenCalled();
    expect(document.querySelector("[contenteditable]")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("hears the page once after the editor connects again", () => {
    connect();
    say({ type: "connect", schema });

    document
      .querySelector("h1")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const clicks = said().filter((message) => message.type === "click");
    expect(clicks).toHaveLength(1);
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
      {
        type: "click",
        target: {
          path: "title",
          point: { x: 0, y: 0 },
          shownText: "Кофейня",
        },
      },
      { type: "link-click", href: "/menu" },
      { type: "key", key: "save" },
    ]);
  });

  it("says which copy of a field shown twice the pointer is over", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<footer><b id="copy" data-cms-path="title">Кофейня</b></footer>`,
    );
    connect();
    const copy = document.querySelector("#copy");
    if (copy === null) throw new Error("No copy of the title in the page");
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 100, 20),
    );

    document
      .querySelector("h1")
      ?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    copy.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

    expect(said().slice(2)).toEqual([
      { type: "hover", path: "title", copy: 0 },
      { type: "hover", path: "title", copy: 1 },
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
      text: "Кофейня",
      isSingleLine: true,
      point: { x: 0, y: 0 },
    });

    expect(said().at(-1)).toEqual({ type: "typing-started", path: "title" });
    expect(document.querySelector("h1")?.getAttribute("contenteditable")).toBe(
      "plaintext-only",
    );
  });

  it("leaves a field of a moving part to the popover", () => {
    document.querySelector("h1")?.setAttribute("data-cms-popover", "");
    connect();

    say({
      type: "start-typing",
      path: "title",
      text: "Кофейня",
      isSingleLine: true,
      point: { x: 0, y: 0 },
    });

    expect(said().at(-1)).toEqual({ type: "typing-refused", path: "title" });
    expect(document.querySelector("h1")?.hasAttribute("contenteditable")).toBe(
      false,
    );
  });
});

describe("a bridge of version 3", () => {
  /** A card whose name is a link stretched over the card, its price under the link. */
  const CARD = `
    <article data-cms-path="menu.0">
      <a data-cms-path="menu.0.name" href="/menu/latte">Латте</a>
      <span data-cms-path="menu.0.price">1 990</span> ₽
    </article>`;
  const boxes: Readonly<Record<string, DOMRect>> = {
    "menu.0": new DOMRect(0, 0, 300, 400),
    "menu.0.name": new DOMRect(0, 0, 300, 400),
    "menu.0.price": new DOMRect(20, 300, 80, 30),
    pickup: new DOMRect(10, 500, 120, 20),
  };

  beforeEach(() => {
    document.body.insertAdjacentHTML("beforeend", CARD);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const key = this.getAttribute("data-cms-path") ?? this.id;
        return boxes[key] ?? new DOMRect(0, 0, 0, 0);
      },
    );
  });

  function element(selector: string): HTMLElement {
    const found = document.querySelector<HTMLElement>(selector);
    if (found === null) throw new Error(`No ${selector} in the page`);
    return found;
  }

  function clickAt(target: Element, x = 0, y = 0): void {
    target.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      }),
    );
  }

  function pressKey(target: Element, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
      ...init,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  function startTypingTitle(): void {
    say({
      type: "start-typing",
      path: "title",
      text: "Кофейня",
      isSingleLine: true,
    });
  }

  it("says it speaks version 3", () => {
    expect(PROTOCOL_VERSION).toBe(3);
  });

  it("chooses the field under a link stretched over its card, and makes it ready to be typed", () => {
    connect();

    clickAt(element('[data-cms-path="menu.0.name"]'), 50, 310);

    const price = element('[data-cms-path="menu.0.price"]');
    expect(said().at(-1)).toEqual({
      type: "click",
      target: {
        path: "menu.0.price",
        point: { x: 50, y: 310 },
        shownText: "1 990",
      },
    });
    expect(price.getAttribute("contenteditable")).toBe("plaintext-only");
    expect(document.activeElement).toBe(price);
  });

  it("says a click outside the fields landed on a text of the site's own", () => {
    connect();

    clickAt(element("#pickup"));
    clickAt(element("#empty"));

    expect(said().slice(-2)).toEqual([
      { type: "click", target: undefined, isStaticText: true },
      { type: "click", target: undefined, isStaticText: false },
    ]);
  });

  it("reports where a hovered text of the site's own is, and when the pointer leaves it", () => {
    connect();
    const hover = (target: Element) => {
      target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    };

    hover(element("#pickup"));
    hover(element("#pickup"));
    hover(element("h1"));

    const hovers = said().filter((message) => message.type === "static-hover");
    expect(hovers).toEqual([
      {
        type: "static-hover",
        box: { top: 500, left: 10, width: 120, height: 20 },
      },
      { type: "static-hover", box: undefined },
    ]);
  });

  it("types a number shown with spaces between thousands, and sends the words typed", () => {
    connect();
    const price = element('[data-cms-path="menu.0.price"]');

    say({
      type: "start-value-typing",
      path: "menu.0.price",
      kind: "number",
      value: 1990,
      point: { x: 50, y: 310 },
    });
    price.textContent = "2 490";
    price.dispatchEvent(new Event("input"));

    expect(said().slice(-2)).toEqual([
      { type: "typing-started", path: "menu.0.price" },
      { type: "typed", path: "menu.0.price", text: "2 490" },
    ]);
  });

  it("takes Tab and Shift+Tab to another field while a text is typed", () => {
    connect();
    startTypingTitle();
    const tab = pressKey(element("h1"), { key: "Tab" });
    startTypingTitle();
    pressKey(element("h1"), { key: "Tab", shiftKey: true });

    expect(tab.defaultPrevented).toBe(true);
    expect(said().filter((message) => message.type === "key")).toEqual([
      { type: "key", key: "next-field" },
      { type: "key", key: "previous-field" },
    ]);
    expect(said().at(-2)).toEqual({
      type: "typing-ended",
      path: "title",
      outcome: "kept",
    });
  });

  it("leaves Tab to the page while nothing is typed", () => {
    connect();

    const tab = pressKey(element("h1"), { key: "Tab" });

    expect(tab.defaultPrevented).toBe(false);
    expect(said().some((message) => message.type === "key")).toBe(false);
  });

  it("ends a typing on Escape keeping the text, and goes no level up", () => {
    connect();
    startTypingTitle();
    element("h1").textContent = "Кофейня у дома";

    pressKey(element("h1"), { key: "Escape" });

    expect(said().at(-1)).toEqual({
      type: "typing-ended",
      path: "title",
      outcome: "kept",
    });
    expect(said().some((message) => message.type === "key")).toBe(false);
    expect(element("h1").textContent).toBe("Кофейня у дома");
  });
});

function fileDrag(): Event & { dataTransfer: { dropEffect: string } } {
  const event = new Event("dragover", { bubbles: true, cancelable: true });
  const dataTransfer = { types: ["Files"], files: [], dropEffect: "none" };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event as Event & { dataTransfer: typeof dataTransfer };
}
