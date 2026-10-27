import { describe, expect, it } from "vitest";
import { normalWords, wordsOf, wordsTextOf } from "./words";

describe("words", () => {
  it("reads a text as its words, split at commas, semicolons and line breaks", () => {
    expect(wordsOf("Бергамот, персик;мёд\nчёрный чай")).toEqual([
      "Бергамот",
      "персик",
      "мёд",
      "чёрный чай",
    ]);
  });

  it("keeps the words trimmed, none empty and none twice, in the order given", () => {
    expect(normalWords([" мёд ", "", "персик", "мёд", "  "])).toEqual([
      "мёд",
      "персик",
    ]);
    expect(wordsOf(" , ,")).toEqual([]);
  });

  it("writes the words as one text that reads back into the same words", () => {
    const words = ["Бергамот", "персик", "чёрный чай"];

    expect(wordsTextOf(words)).toBe("Бергамот, персик, чёрный чай");
    expect(wordsOf(wordsTextOf(words))).toEqual(words);
  });
});
