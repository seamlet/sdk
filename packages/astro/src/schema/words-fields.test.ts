import { describe, expect, expectTypeOf, it } from "vitest";
import {
  defaultContent,
  defineSchema,
  group,
  parseContent,
  text,
  words,
  type ContentOf,
} from "./index";
import { readFields } from "./read-fields";

// A list of words the site shows apart, as tags: the notes of a coffee's taste.

const schema = defineSchema({
  roast: group({
    label: "Зерно недели",
    fields: {
      name: text({ label: "Название" }),
      notes: words({ label: "Ноты во вкусе" }),
    },
  }),
});

describe("a words field", () => {
  it("gives the site a list of strings, empty by default", () => {
    expectTypeOf<ContentOf<typeof schema>["roast"]["notes"]>().toEqualTypeOf<
      readonly string[]
    >();
    expect(defaultContent(schema).roast).toEqual({ name: "", notes: [] });
  });

  it("keeps its words trimmed, none empty and none twice", () => {
    const parsed = parseContent(schema, {
      roast: { name: "Кения", notes: [" Бергамот ", "", "мёд", "мёд"] },
    });

    expect(parsed.content.roast.notes).toEqual(["Бергамот", "мёд"]);
    expect(parsed.issues).toEqual([]);
  });

  it("reads a text saved before the field became a list as its words", () => {
    const parsed = parseContent(schema, {
      roast: { name: "Кения", notes: "Бергамот, персик, чёрный чай, мёд" },
    });

    expect(parsed.content.roast.notes).toEqual([
      "Бергамот",
      "персик",
      "чёрный чай",
      "мёд",
    ]);
    expect(parsed.issues).toEqual([]);
  });

  it("refuses what is neither a list of words nor a text", () => {
    const parsed = parseContent(schema, { roast: { name: "", notes: 7 } });

    expect(parsed.content.roast.notes).toEqual([]);
    expect(parsed.issues).toEqual([
      { path: ["roast", "notes"], code: "invalid-type" },
    ]);
  });

  it("gives a text field that was a list its words between commas", () => {
    const asText = defineSchema({ notes: text({ label: "Ноты" }) });

    const parsed = parseContent(asText, { notes: ["Бергамот", "мёд"] });

    expect(parsed.content.notes).toBe("Бергамот, мёд");
  });

  it("reads back from JSON in a site's description", () => {
    const sent: unknown = JSON.parse(JSON.stringify(schema));

    expect(readFields(sent)).toEqual(schema);
  });
});
