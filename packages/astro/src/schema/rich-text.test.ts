import { describe, expect, it } from "vitest";
import { defineSchema, richText } from "./fields";
import { parseContent } from "./parse-content";
import { plainTextOf, readRichText, richTextOf } from "./rich-text";

const schema = defineSchema({
  about: richText({ label: "О студии", maxLength: 40 }),
  note: richText({ label: "Подпись", inline: true }),
});

describe("formatted text", () => {
  it("keeps paragraphs, lists, marks and links", () => {
    const about = [
      {
        kind: "paragraph",
        spans: [
          { text: "Запись в " },
          { text: "расписании", href: "/raspisanie", bold: true },
        ],
      },
      { kind: "list", items: [[{ text: "Коврики", italic: true }]] },
    ];

    const parsed = parseContent(schema, { about, note: [] });

    expect(parsed.content.about).toEqual(about);
    expect(parsed.issues).toEqual([]);
  });

  it("joins neighbors with the same marks and leaves out empty pieces", () => {
    expect(
      readRichText([
        {
          kind: "paragraph",
          spans: [{ text: "Кофе" }, { text: "" }, { text: "йня" }],
        },
        { kind: "paragraph", spans: [] },
      ]),
    ).toEqual([{ kind: "paragraph", spans: [{ text: "Кофейня" }] }]);
  });

  it("takes a plain text as paragraphs, so a text field keeps its words", () => {
    expect(richTextOf("Первый абзац\n\nВторой")).toEqual([
      { kind: "paragraph", spans: [{ text: "Первый абзац" }] },
      { kind: "paragraph", spans: [{ text: "Второй" }] },
    ]);
    expect(
      parseContent(schema, { about: "Просто текст" }).content.about,
    ).toEqual([{ kind: "paragraph", spans: [{ text: "Просто текст" }] }]);
  });

  it("keeps an inline text one paragraph without lists", () => {
    const note = [
      { kind: "paragraph", spans: [{ text: "Раз" }] },
      { kind: "list", items: [[{ text: "два" }]] },
    ];

    expect(parseContent(schema, { note }).content.note).toEqual([
      { kind: "paragraph", spans: [{ text: "Раз два" }] },
    ]);
  });

  it("names a link that may not lead there and a text that is too long", () => {
    const about = [
      {
        kind: "paragraph",
        spans: [
          { text: "Нажмите", href: "javascript:alert(1)" },
          { text: " — и ещё много-много слов сверх лимита" },
        ],
      },
    ];

    const codes = parseContent(schema, { about }).issues.map(
      (issue) => issue.code,
    );

    expect(codes).toEqual(["unsupported-link-href", "too-long"]);
  });

  it("drops what is not formatted text", () => {
    const parsed = parseContent(schema, { about: [{ kind: "table" }] });

    expect(parsed.content.about).toEqual([]);
    expect(parsed.issues.map((issue) => issue.code)).toEqual(["invalid-type"]);
  });

  it("gives the words of a text without its marks", () => {
    expect(
      plainTextOf([
        {
          kind: "paragraph",
          spans: [{ text: "А " }, { text: "б", bold: true }],
        },
        { kind: "list", items: [[{ text: "в" }], [{ text: "г" }]] },
      ]),
    ).toBe("А б\n\nв\nг");
  });
});
