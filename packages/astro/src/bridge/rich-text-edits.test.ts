import { describe, expect, it } from "vitest";
import type { RichText } from "../schema";
import {
  formatsAt,
  linkSelectionAt,
  setLink,
  toggleList,
  toggleMark,
} from "./rich-text-edits";

const text: RichText = [
  { kind: "paragraph", spans: [{ text: "Записаться в студию" }] },
  { kind: "paragraph", spans: [{ text: "Коврики" }] },
  { kind: "paragraph", spans: [{ text: "Чай" }] },
];

const words = (line: number, from: number, to: number) => ({
  start: { line, offset: from },
  end: { line, offset: to },
});

describe("editing formatted text", () => {
  it("marks the selected words bold, cutting the piece at the selection", () => {
    expect(toggleMark(text, words(0, 0, 10), "bold")[0]).toEqual({
      kind: "paragraph",
      spans: [{ text: "Записаться", bold: true }, { text: " в студию" }],
    });
  });

  it("takes a mark off when every selected word has it", () => {
    const bold = toggleMark(text, words(0, 0, 10), "bold");

    expect(toggleMark(bold, words(0, 0, 10), "bold")[0]).toEqual(text[0]);
  });

  it("puts a link on the selected words and takes it off", () => {
    const linked = setLink(text, words(0, 13, 19), "/raspisanie");

    expect(linked[0]).toEqual({
      kind: "paragraph",
      spans: [
        { text: "Записаться в " },
        { text: "студию", href: "/raspisanie" },
      ],
    });
    expect(setLink(linked, words(0, 0, 19), undefined)[0]).toEqual(text[0]);
  });

  it("marks across lines", () => {
    const selection = {
      start: { line: 0, offset: 13 },
      end: { line: 1, offset: 3 },
    };

    expect(toggleMark(text, selection, "italic").slice(0, 2)).toEqual([
      {
        kind: "paragraph",
        spans: [{ text: "Записаться в " }, { text: "студию", italic: true }],
      },
      {
        kind: "paragraph",
        spans: [{ text: "Ков", italic: true }, { text: "рики" }],
      },
    ]);
  });

  it("makes the selected lines one list, and paragraphs again", () => {
    const selection = {
      start: { line: 1, offset: 0 },
      end: { line: 2, offset: 1 },
    };
    const listed = toggleList(text, selection);

    expect(listed).toEqual([
      text[0],
      { kind: "list", items: [[{ text: "Коврики" }], [{ text: "Чай" }]] },
    ]);
    expect(toggleList(listed, selection)).toEqual(text);
  });

  it("tells what every selected word has", () => {
    const marked: RichText = [
      {
        kind: "paragraph",
        spans: [
          { text: "Записаться", bold: true, href: "/zapis" },
          { text: " в студию", href: "/zapis" },
        ],
      },
      { kind: "list", items: [[{ text: "Коврики", italic: true }]] },
    ];

    expect(formatsAt(marked, words(0, 0, 10))).toEqual({
      isBold: true,
      isItalic: false,
      isList: false,
      href: "/zapis",
    });
    expect(formatsAt(marked, words(0, 5, 15)).isBold).toBe(false);
    expect(formatsAt(marked, words(1, 2, 2))).toEqual({
      isBold: false,
      isItalic: true,
      isList: true,
      href: undefined,
    });
  });

  it("finds the whole link the cursor is in, whatever marks its words have", () => {
    const linked: RichText = [
      {
        kind: "paragraph",
        spans: [
          { text: "Ждём " },
          { text: "в студии", bold: true, href: "/kontakty" },
          { text: " на Ленина", href: "/kontakty" },
          { text: " каждый день" },
        ],
      },
    ];

    expect(linkSelectionAt(linked, { line: 0, offset: 7 })).toEqual(
      words(0, 5, 23),
    );
    expect(linkSelectionAt(linked, { line: 0, offset: 2 })).toBeUndefined();
  });
});
