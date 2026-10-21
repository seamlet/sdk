// The address of a record's page is a word of a URL: `latte` in `/menu/latte`. Its letters are those
// of a page's address, so a record's page reads like any other page of the site, and the words a
// person types in Russian become such a word by the rules of transliteration.

/** One segment of a page's address: lower-case Latin letters, digits and hyphens. */
export const PAGE_SEGMENT = "[a-z0-9][a-z0-9-]*";
/** Long enough for a name of a product, short enough to read in an address. */
export const MAX_SLUG_LENGTH = 80;

const SLUG_PATTERN = new RegExp(`^${PAGE_SEGMENT}$`, "u");
const NOT_SLUG_CHARACTERS = /[^a-z0-9]+/gu;
const EDGE_HYPHENS = /^-+|-+$/gu;
/** What decomposing a letter leaves of its accent: `é` is `e` and a mark. */
const COMBINING_MARKS = /\p{M}/gu;
const HYPHEN = "-";

/** Cyrillic letters as Latin ones, the way addresses of Russian sites spell them. */
const TRANSLITERATION: ReadonlyMap<string, string> = new Map(
  Object.entries({
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
    // Letters of Ukrainian and Belarusian words a Russian text may quote.
    і: "i",
    ї: "yi",
    є: "ye",
    ґ: "g",
    ў: "u",
    // «Баня 6×4» is `banya-6x4`, the way its size is said.
    "×": "x",
  }),
);

/** The characters the table spells otherwise. */
const TRANSLITERATED = new RegExp(
  `[${[...TRANSLITERATION.keys()].join("")}]`,
  "gu",
);

/** Whether the value can be the address of a record's page: `latte`, `banya-6x4`. */
export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

/**
 * The address a record's page takes from words: «Баня из бруса 6×4» is `banya-iz-brusa-6x4`. Empty
 * when the words have no letter or digit to keep.
 */
export function slugOf(words: string): string {
  // Composed first: «й» typed as «и» and a mark is still «й».
  const latin = words
    .normalize("NFC")
    .toLowerCase()
    .replace(
      TRANSLITERATED,
      (character) => TRANSLITERATION.get(character) ?? character,
    )
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "");
  // Decomposing may bring capitals back: «№» is «No».
  const hyphenated = latin
    .toLowerCase()
    .replace(NOT_SLUG_CHARACTERS, HYPHEN)
    .replace(EDGE_HYPHENS, "");
  return shortened(hyphenated);
}

/** Cut to the longest slug at a hyphen, so no word is cut in the middle when it can be helped. */
function shortened(slug: string): string {
  if (slug.length <= MAX_SLUG_LENGTH) return slug;

  const cut = slug.slice(0, MAX_SLUG_LENGTH);
  const isWordWhole = slug[MAX_SLUG_LENGTH] === HYPHEN;
  if (isWordWhole) return cut;

  const lastHyphen = cut.lastIndexOf(HYPHEN);
  const whole = lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut;
  return whole.replace(EDGE_HYPHENS, "");
}
