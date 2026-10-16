// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  canEditTextInPlace,
  normalizeSpaces,
  readElementText,
} from "./element-text";

function elementOf(html: string): HTMLElement {
  document.body.innerHTML = html;
  const element = document.body.firstElementChild;
  if (!(element instanceof HTMLElement)) throw new Error("No element");
  return element;
}

describe("readElementText", () => {
  it("drops the whitespace of the markup and keeps line breaks", () => {
    const element = elementOf(
      "<p>\n    Двойная   порция,<br>плотный <b>и</b> сладкий.\n  </p>",
    );

    expect(readElementText(element)).toBe(
      "Двойная порция,\nплотный и сладкий.",
    );
  });

  it("reads the text as it is written, not as CSS transforms it", () => {
    const element = elementOf(
      '<p style="text-transform: uppercase">Ближайшее событие</p>',
    );

    expect(readElementText(element)).toBe("Ближайшее событие");
  });

  it("keeps the line breaks of the text where the element shows them", () => {
    const element = elementOf(
      '<p style="white-space: pre-line">Первая  строка\n  вторая</p>',
    );

    expect(readElementText(element)).toBe("Первая строка\nвторая");
  });

  it("keeps a space typed after another one", () => {
    expect(readElementText(elementOf("<p>Кофе\u00a0 дня</p>"))).toBe(
      "Кофе  дня",
    );
  });
});

describe("canEditTextInPlace", () => {
  it("allows an element that shows the value as it is", () => {
    expect(
      canEditTextInPlace(elementOf("<h1>\n  Кофейня\n</h1>"), "Кофейня"),
    ).toBe(true);
  });

  it("allows a text with line breaks only where the element shows them", () => {
    const text = "Первая строка\nвторая строка";

    expect(canEditTextInPlace(elementOf(`<p>${text}</p>`), text)).toBe(false);
    expect(
      canEditTextInPlace(
        elementOf(`<p style="white-space: pre-line">${text}</p>`),
        text,
      ),
    ).toBe(true);
    expect(
      canEditTextInPlace(
        elementOf("<p>Первая строка<br>вторая строка</p>"),
        text,
      ),
    ).toBe(true);
  });

  it("refuses a formatted value and an element with marked fields inside", () => {
    expect(canEditTextInPlace(elementOf("<span>150 ₽</span>"), "150")).toBe(
      false,
    );
    expect(
      canEditTextInPlace(
        elementOf('<p><span data-cms-path="a">Кофе</span></p>'),
        "Кофе",
      ),
    ).toBe(false);
  });
});

describe("normalizeSpaces", () => {
  it("makes every run of spaces one space and keeps line breaks", () => {
    expect(normalizeSpaces(" a\t b\u00a0 c \n  d ")).toBe("a b c\nd");
  });
});
