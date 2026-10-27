// The one rule of a list of words (a `words` field): the notes of a coffee's taste, the woods a
// sauna is built of. Its words are kept in the order given, each without the spaces around it,
// none empty and none twice. Written as one text (a cell of a table, a field that was a text
// before) they stand between commas, and such a text is read back into the same words.

/** What stands between the words of a list written as one text. */
export const WORDS_SEPARATOR = ", ";

/** What a text is split at when read as words: a comma, a semicolon or a line break. */
const WORD_BREAKS = /[,;\n]/u;

/** The words of a list in their normal form: trimmed, none empty, none twice. */
export function normalWords(words: readonly string[]): string[] {
  const trimmed = words.map((word) => word.trim());
  const named = trimmed.filter((word) => word !== "");
  return [...new Set(named)];
}

/** «Бергамот, персик; мёд» → ["Бергамот", "персик", "мёд"]. */
export function wordsOf(text: string): string[] {
  return normalWords(text.split(WORD_BREAKS));
}

/** ["Бергамот", "персик", "мёд"] → «Бергамот, персик, мёд». */
export function wordsTextOf(words: readonly string[]): string {
  return words.join(WORDS_SEPARATOR);
}
