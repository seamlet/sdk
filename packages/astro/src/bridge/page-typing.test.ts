// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageMessage } from "./messages";
import { createPageTyping, type PageTyping } from "./page-typing";

const send = vi.fn<(message: PageMessage) => void>();
let typing: PageTyping;

beforeEach(() => {
  document.body.innerHTML = `
    <h1 data-cms-path="title">Зерно</h1>
    <p data-cms-path="menu.0.description">Плотный</p>
    <span data-cms-path="menu.0.price">150 ₽</span>
    <div data-cms-path="menu.0"><p data-cms-path="menu.0.name">Эспрессо</p></div>`;
  send.mockReset();
  typing = createPageTyping({ document, send, onInput: () => undefined });
});

function marked(path: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-cms-path="${path}"]`,
  );
  if (element === null) throw new Error(`Nothing is marked with ${path}`);
  return element;
}

function startAt(path: string, text: string, isSingleLine = true): void {
  typing.start({
    type: "start-typing",
    path,
    text,
    isSingleLine,
    point: { x: 0, y: 0 },
  });
}

function type(element: HTMLElement, typed: string): void {
  element.textContent = typed;
  element.dispatchEvent(new Event("input"));
}

function press(element: HTMLElement, key: string): void {
  element.dispatchEvent(
    new KeyboardEvent("keydown", { key, cancelable: true }),
  );
}

describe("createPageTyping", () => {
  it("types a text shown as it is and sends every typed character", () => {
    startAt("title", "Зерно");
    type(marked("title"), "Зерно и чай");
    press(marked("title"), "Enter");

    expect(send.mock.calls).toEqual([
      [{ type: "typing-started", path: "title" }],
      [{ type: "typed", path: "title", text: "Зерно и чай" }],
      [{ type: "typing-ended", path: "title", outcome: "kept" }],
    ]);
    expect(typing.isTyping()).toBe(false);
    expect(marked("title").hasAttribute("contenteditable")).toBe(false);
  });

  it("refuses a formatted value, an element with other fields and a text the page shows otherwise", () => {
    startAt("menu.0.price", "150");
    startAt("menu.0", "Эспрессо");
    startAt("title", "Зерно — кофейня");
    startAt("contacts.phone", "+7");

    expect(send.mock.calls).toEqual([
      [{ type: "typing-refused", path: "menu.0.price" }],
      [{ type: "typing-refused", path: "menu.0" }],
      [{ type: "typing-refused", path: "title" }],
      [{ type: "typing-refused", path: "contacts.phone" }],
    ]);
    expect(typing.isTyping()).toBe(false);
  });

  it("takes Enter as a line break in a multiline text", () => {
    startAt("menu.0.description", "Плотный", false);

    press(marked("menu.0.description"), "Enter");

    expect(typing.isTyping()).toBe(true);
  });

  it("tells the editor to bring the text back on Escape", () => {
    startAt("title", "Зерно");
    type(marked("title"), "Зерно и");

    press(marked("title"), "Escape");

    expect(send).toHaveBeenLastCalledWith({
      type: "typing-ended",
      path: "title",
      outcome: "reverted",
    });
  });

  it("ends the typing when told to", () => {
    startAt("title", "Зерно");

    typing.stop();

    expect(typing.isTyping()).toBe(false);
    expect(send).toHaveBeenLastCalledWith({
      type: "typing-ended",
      path: "title",
      outcome: "kept",
    });
  });

  it("types formatted text shown as it is and sends it with every change", () => {
    document.body.innerHTML = `<div data-cms-path="about"><p>Студия</p></div>`;
    const about = marked("about");
    typing.startRich({
      type: "start-rich-typing",
      path: "about",
      text: [{ kind: "paragraph", spans: [{ text: "Студия" }] }],
      isInline: false,
      point: { x: 0, y: 0 },
    });
    about.querySelector("p")?.append(" йоги");
    about.dispatchEvent(new Event("input"));
    typing.stop();

    expect(send.mock.calls).toEqual([
      [{ type: "typing-started", path: "about" }],
      [
        {
          type: "rich-typed",
          path: "about",
          text: [{ kind: "paragraph", spans: [{ text: "Студия йоги" }] }],
        },
      ],
      [{ type: "typed-selection", path: "about", selection: undefined }],
      [{ type: "typing-ended", path: "about", outcome: "kept" }],
    ]);
    expect(typing.isTyping()).toBe(false);
  });

  it("refuses formatted text its element does not show as it is", () => {
    typing.startRich({
      type: "start-rich-typing",
      path: "title",
      text: [{ kind: "paragraph", spans: [{ text: "Зерно", bold: true }] }],
      isInline: true,
      point: { x: 0, y: 0 },
    });

    expect(send).toHaveBeenCalledWith({
      type: "typing-refused",
      path: "title",
    });
    expect(typing.isTyping()).toBe(false);
  });
});
