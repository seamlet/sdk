// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { RichText } from "../schema";
import type { TypedSelection } from "./messages";
import {
  canEditRichTextInPlace,
  startRichTextEditing,
} from "./rich-text-editing";
import { richTextLayoutOf } from "./rich-text-layouts";

const about: RichText = [
  {
    kind: "paragraph",
    spans: [{ text: "Студия " }, { text: "на 11 этаже", bold: true }],
  },
];

// jsdom lays nothing out: a range has the box of the line it would be in.
const lineBox = { top: 40, left: 10, width: 120, height: 20 };
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: lineBox.left, y: lineBox.top, ...lineBox });
  Range.prototype.getClientRects = () =>
    ({ length: 0, item: () => null }) as unknown as DOMRectList;
});

function shown(html: string): HTMLElement {
  document.body.innerHTML = `<div data-cms-path="about">${html}</div>`;
  const element = document.querySelector<HTMLElement>("[data-cms-path]");
  if (element === null) throw new Error("No element");
  return element;
}

function startEditing(element: HTMLElement, isInline = false) {
  const onInput = vi.fn<(text: RichText) => void>();
  const onSelect = vi.fn<(selection: TypedSelection | undefined) => void>();
  const onEnd = vi.fn<(outcome: "kept" | "reverted") => void>();
  const editing = startRichTextEditing(element, {
    layout: richTextLayoutOf(isInline),
    onInput,
    onSelect,
    onEnd,
  });
  return { editing, onInput, onSelect, onEnd };
}

function selectWords(element: HTMLElement, from: number, to: number): void {
  const words = element.querySelector("p")?.firstChild;
  if (words === null || words === undefined) throw new Error("No words");
  document.getSelection()?.setBaseAndExtent(words, from, words, to);
  document.dispatchEvent(new Event("selectionchange"));
}

function press(element: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { ...init, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe("canEditRichTextInPlace", () => {
  it("takes an element that shows the text as it is", () => {
    const element = shown("<p>Студия <strong>на 11 этаже</strong></p>");

    expect(
      canEditRichTextInPlace(element, about, richTextLayoutOf(false)),
    ).toBe(true);
  });

  it("refuses an element that shows something else or holds other fields", () => {
    const other = shown("<p>Студия на 11 этаже</p>");
    expect(canEditRichTextInPlace(other, about, richTextLayoutOf(false))).toBe(
      false,
    );

    const withField = shown(
      '<p>Студия <strong data-cms-path="floor">на 11 этаже</strong></p>',
    );
    expect(
      canEditRichTextInPlace(withField, about, richTextLayoutOf(false)),
    ).toBe(false);
  });

  it("takes the words alone in an element of one line", () => {
    const element = shown("Студия <strong>на 11 этаже</strong>");

    expect(canEditRichTextInPlace(element, about, richTextLayoutOf(true))).toBe(
      true,
    );
  });
});

describe("startRichTextEditing", () => {
  it("makes the element editable and reports the typed text", () => {
    const element = shown("<p>Студия <strong>на 11 этаже</strong></p>");
    const { onInput } = startEditing(element);

    element.querySelector("strong")?.append(" в Кирове");
    element.dispatchEvent(new Event("input"));

    expect(element.getAttribute("contenteditable")).toBe("true");
    expect(onInput).toHaveBeenLastCalledWith([
      {
        kind: "paragraph",
        spans: [
          { text: "Студия " },
          { text: "на 11 этаже в Кирове", bold: true },
        ],
      },
    ]);
  });

  it("marks the selected words italic with ⌘I, by the place of the key", () => {
    const element = shown("<p>Студия <strong>на 11 этаже</strong></p>");
    const { onInput } = startEditing(element);
    selectWords(element, 0, 6);

    const event = press(element, { key: "ш", code: "KeyI", metaKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(element.innerHTML).toBe(
      "<p><em>Студия</em> <strong>на 11 этаже</strong></p>",
    );
    expect(onInput).toHaveBeenLastCalledWith([
      {
        kind: "paragraph",
        spans: [
          { text: "Студия", italic: true },
          { text: " " },
          { text: "на 11 этаже", bold: true },
        ],
      },
    ]);
  });

  it("tells the editor where the selection is and what its words have", () => {
    vi.useFakeTimers();
    const element = shown("<p>Студия <strong>на 11 этаже</strong></p>");
    const { onSelect } = startEditing(element);
    selectWords(element, 0, 6);

    vi.advanceTimersToNextFrame();

    expect(onSelect).toHaveBeenLastCalledWith({
      box: lineBox,
      isCollapsed: false,
      formats: {
        isBold: false,
        isItalic: false,
        isList: false,
        href: undefined,
      },
    });
    vi.useRealTimers();
  });

  it("puts a link on the selection the editor's toolbar names, and takes it off", () => {
    const element = shown("<p>Студия <strong>на 11 этаже</strong></p>");
    const { editing, onInput } = startEditing(element);
    selectWords(element, 0, 6);

    editing.setLink("/kontakty");
    expect(element.querySelector("a")?.getAttribute("href")).toBe("/kontakty");

    const link = element.querySelector("a")?.firstChild;
    if (link === null || link === undefined) throw new Error("No link");
    document.getSelection()?.setBaseAndExtent(link, 2, link, 2);
    document.dispatchEvent(new Event("selectionchange"));
    editing.setLink(undefined);

    expect(element.querySelector("a")).toBeNull();
    expect(onInput).toHaveBeenLastCalledWith(about);
  });

  it("puts no link that would run code", () => {
    const element = shown("<p>Студия <strong>на 11 этаже</strong></p>");
    const { editing, onInput } = startEditing(element);
    selectWords(element, 0, 6);

    editing.setLink("javascript:alert(1)");

    expect(element.querySelector("a")).toBeNull();
    expect(onInput).not.toHaveBeenCalled();
  });

  it("ends on Enter in an element of one line, and brings the text back on Escape", () => {
    const heading = shown("Студия <strong>на 11 этаже</strong>");
    const inline = startEditing(heading, true);
    press(heading, { key: "Enter" });
    expect(inline.onEnd).toHaveBeenCalledWith("kept");
    expect(heading.hasAttribute("contenteditable")).toBe(false);

    const element = shown("<p>Студия <strong>на 11 этаже</strong></p>");
    const block = startEditing(element);
    press(element, { key: "Escape" });
    expect(block.onEnd).toHaveBeenCalledWith("reverted");
    expect(block.onSelect).toHaveBeenLastCalledWith(undefined);
  });

  it("pastes the words without the formatting of where they were copied from", () => {
    const element = shown("<p>Студия <strong>на 11 этаже</strong></p>");
    const { onInput } = startEditing(element, true);
    selectWords(element, 0, 6);
    const paste = new Event("paste", { cancelable: true });
    Object.assign(paste, {
      clipboardData: { getData: () => "Йога\nв Кирове" },
    });

    element.dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(true);
    expect(onInput).toHaveBeenLastCalledWith([
      {
        kind: "paragraph",
        spans: [
          { text: "Йога в Кирове " },
          { text: "на 11 этаже", bold: true },
        ],
      },
    ]);
  });
});
