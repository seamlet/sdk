// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageMessage } from "./messages";
import {
  createPageTyping,
  PREPARED_TYPING_TIMEOUT_MS,
  type PageTyping,
} from "./page-typing";

const send = vi.fn<(message: PageMessage) => void>();
const onTypingOver = vi.fn<() => void>();
let typing: PageTyping;

beforeEach(() => {
  document.body.innerHTML = `
    <h1 data-cms-path="title">Кофейня</h1>
    <p data-cms-path="menu.0.description">Плотный</p>
    <span data-cms-path="menu.0.price">150 ₽</span>
    <div data-cms-path="menu.0"><p data-cms-path="menu.0.name">Эспрессо</p></div>`;
  send.mockReset();
  onTypingOver.mockReset();
  typing = createPageTyping({
    document,
    send,
    onInput: () => undefined,
    onTypingOver,
  });
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
  it("says when nothing is typed any more: the typing ended, or was refused", () => {
    startAt("title", "Кофейня");
    expect(onTypingOver).not.toHaveBeenCalled();
    press(marked("title"), "Enter");
    expect(onTypingOver).toHaveBeenCalledTimes(1);

    startAt("menu.0", "Эспрессо");
    expect(onTypingOver).toHaveBeenCalledTimes(2);
  });

  it("says nothing while a tapped text waits for the editor, and says it once the wait is over", () => {
    vi.useFakeTimers();
    typing.prepare(marked("title"), "plain");
    startAt("menu.0", "Эспрессо");
    expect(onTypingOver).toHaveBeenCalledTimes(1);

    typing.prepare(marked("title"), "plain");
    expect(onTypingOver).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PREPARED_TYPING_TIMEOUT_MS);
    expect(onTypingOver).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("types a text shown as it is and sends every typed character", () => {
    startAt("title", "Кофейня");
    type(marked("title"), "Кофейня и чай");
    press(marked("title"), "Enter");

    expect(send.mock.calls).toEqual([
      [{ type: "typing-started", path: "title" }],
      [{ type: "typed", path: "title", text: "Кофейня и чай" }],
      [{ type: "typing-ended", path: "title", outcome: "kept" }],
    ]);
    expect(typing.isTyping()).toBe(false);
    expect(marked("title").hasAttribute("contenteditable")).toBe(false);
  });

  it("refuses a formatted value, an element with other fields and a text the page shows otherwise", () => {
    startAt("menu.0.price", "150");
    startAt("menu.0", "Эспрессо");
    startAt("title", "Кофейня у дома");
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
    startAt("title", "Кофейня");
    type(marked("title"), "Кофейня и");

    press(marked("title"), "Escape");

    expect(send).toHaveBeenLastCalledWith({
      type: "typing-ended",
      path: "title",
      outcome: "reverted",
    });
  });

  it("ends the typing when told to", () => {
    startAt("title", "Кофейня");

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
      text: [{ kind: "paragraph", spans: [{ text: "Кофейня", bold: true }] }],
      isInline: true,
      point: { x: 0, y: 0 },
    });

    expect(send).toHaveBeenCalledWith({
      type: "typing-refused",
      path: "title",
    });
    expect(typing.isTyping()).toBe(false);
  });

  it("makes a tapped text editable and focused at once, so a phone shows its keyboard", () => {
    const title = marked("title");
    typing.prepare(title, "plain");

    expect(title.getAttribute("contenteditable")).toBe("plaintext-only");
    expect(document.activeElement).toBe(title);

    startAt("title", "Кофейня");
    expect(typing.isTyping()).toBe(true);
    expect(document.activeElement).toBe(title);
  });

  it("leaves a tapped text as it was when the page cannot type it or the editor never asks", () => {
    vi.useFakeTimers();
    const price = marked("menu.0.price");
    typing.prepare(price, "plain");
    startAt("menu.0.price", "Другая цена");

    expect(price.hasAttribute("contenteditable")).toBe(false);

    const title = marked("title");
    typing.prepare(title, "plain");
    vi.advanceTimersByTime(PREPARED_TYPING_TIMEOUT_MS);

    expect(title.hasAttribute("contenteditable")).toBe(false);
    expect(document.activeElement).not.toBe(title);
    vi.useRealTimers();
  });
});
