import { readElementText } from "./element-text";
import type { TypedValue, TypedValueKind } from "./messages";
import { hasMarkedDescendants } from "./page-markers";

// A number or a time typed right in the element that shows it. The element must show the value as
// it is: the digits of a number, written the way a price is (spaces between thousands, a decimal
// comma), with a unit outside the marked element, or a time as `19:00`. While it is typed, only the
// characters of such words go in; the editor reads the words by its own rule.

/** The characters a person types into each kind of value: digits and the signs between them. */
export const TYPED_VALUE_CHARACTERS: Readonly<Record<TypedValueKind, RegExp>> =
  {
    number: /^[\d ,\u00a0\u202f]*$/u,
    time: /^[\d:]*$/u,
  };

/** Spaces a site puts between thousands: no-break, narrow no-break, thin. */
const THOUSANDS_SPACES = /[\u00a0\u202f\u2009]/gu;
const UNICODE_MINUS = /\u2212/gu;
/** A number as a page shows it: `240`, `1 990`, `1990`, `2,5`, `2.5`. */
const NUMBER_WORDS = /^-?(?:\d{1,3}(?: \d{3})+|\d+)(?:[.,]\d+)?$/u;
const GROUP_SPACE = / /gu;

/** The number the words show, or undefined for words that are not a number alone. */
export function numberShownBy(words: string): number | undefined {
  const tidied = words
    .replace(THOUSANDS_SPACES, " ")
    .replace(UNICODE_MINUS, "-")
    .trim();
  if (!NUMBER_WORDS.test(tidied)) return undefined;

  const digits = tidied.replace(GROUP_SPACE, "").replace(",", ".");
  return Number(digits);
}

/** Whether the element shows the value as it is and holds no other field, so it can be typed there. */
export function canTypeValueInPlace(
  element: Element,
  typed: TypedValue,
): boolean {
  if (hasMarkedDescendants(element)) return false;

  const shown = readElementText(element);
  switch (typed.kind) {
    case "number":
      return numberShownBy(shown) === typed.value;
    case "time":
      return shown === typed.value;
  }
}
