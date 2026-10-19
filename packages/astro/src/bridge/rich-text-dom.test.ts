// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { RichText } from "../schema";
import {
  insertPlainText,
  readRichTextFrom,
  renderInlineRichText,
  readSelectionFrom,
  renderRichText,
  selectIn,
} from "./rich-text-dom";

function editable(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element;
}

describe("formatted text in its editable element", () => {
  it("is shown as the site shows it and read back the same", () => {
    const text: RichText = [
      {
        kind: "paragraph",
        spans: [
          { text: "Запись в " },
          { text: "расписании", bold: true, href: "/raspisanie" },
          { text: "\nи по телефону", italic: true },
        ],
      },
      { kind: "list", items: [[{ text: "Коврики" }], [{ text: "Чай" }]] },
    ];
    const element = document.createElement("div");

    renderRichText(element, text);

    expect(element.innerHTML).toBe(
      '<p>Запись в <a href="/raspisanie"><strong>расписании</strong></a><em><br>и по телефону</em></p><ul><li>Коврики</li><li>Чай</li></ul>',
    );
    expect(readRichTextFrom(element)).toEqual(text);
  });

  it("reads what a browser makes of typing: lines in divs, b and i, a closing br", () => {
    const element = editable(
      "Первая<div><b>Вторая</b> <i>строка</i><br></div><div><br></div>",
    );

    expect(readRichTextFrom(element)).toEqual([
      { kind: "paragraph", spans: [{ text: "Первая" }] },
      {
        kind: "paragraph",
        spans: [
          { text: "Вторая", bold: true },
          { text: " " },
          { text: "строка", italic: true },
        ],
      },
    ]);
  });

  it("keeps the words of elements it does not know, without them", () => {
    const element = editable(
      '<p><span style="color:red">Красный</span> текст</p>',
    );

    expect(readRichTextFrom(element)).toEqual([
      { kind: "paragraph", spans: [{ text: "Красный текст" }] },
    ]);
  });

  it("reads the selection in lines and characters, and puts it back", () => {
    const element = editable("Первая<div><b>Вто</b>рая строка</div>");
    document.body.append(element);
    const second = element.querySelector("div");
    const bold = element.querySelector("b")?.firstChild;
    const rest = second?.lastChild;
    if (
      bold === null ||
      bold === undefined ||
      rest === null ||
      rest === undefined
    )
      throw new Error("The element has no second line");

    document.getSelection()?.setBaseAndExtent(rest, 4, bold, 1);
    const selection = readSelectionFrom(element);

    expect(selection).toEqual({
      start: { line: 1, offset: 1 },
      end: { line: 1, offset: 7 },
    });

    renderRichText(element, readRichTextFrom(element));
    if (selection !== undefined) selectIn(element, selection);

    expect(document.getSelection()?.toString()).toBe("торая ");
    element.remove();
  });

  it("reads the site's own elements without the whitespace of their markup", () => {
    const element = editable(
      "\n  <p>\n    Йога для <strong>всех</strong>\n  </p>\n  <ul>\n    <li>Хатха</li>\n  </ul>\n",
    );

    expect(readRichTextFrom(element)).toEqual([
      {
        kind: "paragraph",
        spans: [{ text: "Йога для " }, { text: "всех", bold: true }],
      },
      { kind: "list", items: [[{ text: "Хатха" }]] },
    ]);
  });

  it("shows the words alone in an element of one line, and selects in them", () => {
    const text: RichText = [
      {
        kind: "paragraph",
        spans: [{ text: "Йога " }, { text: "на 11 этаже", italic: true }],
      },
    ];
    const element = document.createElement("h1");
    document.body.append(element);

    renderInlineRichText(element, text);
    selectIn(element, {
      start: { line: 0, offset: 5 },
      end: { line: 0, offset: 7 },
    });

    expect(element.innerHTML).toBe("Йога <em>на 11 этаже</em>");
    expect(readRichTextFrom(element)).toEqual(text);
    expect(document.getSelection()?.toString()).toBe("на");
    element.remove();
  });

  it("puts plain words in place of the selection, line breaks as br", () => {
    const element = editable("<p>Чай</p>");
    document.body.append(element);
    const words = element.querySelector("p")?.firstChild;
    if (words === null || words === undefined) throw new Error("No words");
    document.getSelection()?.setBaseAndExtent(words, 3, words, 3);

    insertPlainText(element, " и кофе\nкаждый день");

    expect(readRichTextFrom(element)).toEqual([
      { kind: "paragraph", spans: [{ text: "Чай и кофе\nкаждый день" }] },
    ]);
    element.remove();
  });
});
