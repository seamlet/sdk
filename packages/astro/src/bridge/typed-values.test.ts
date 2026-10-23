// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { canTypeValueInPlace, numberShownBy } from "./typed-values";

function shown(html: string): HTMLElement {
  document.body.innerHTML = `<span data-cms-path="menu.0.price">${html}</span>`;
  const element = document.querySelector<HTMLElement>("span");
  if (element === null) throw new Error("No element");
  return element;
}

describe("numberShownBy", () => {
  it("reads a number as a page writes a price", () => {
    expect(numberShownBy("240")).toBe(240);
    expect(numberShownBy("1 990")).toBe(1990);
    expect(numberShownBy("1\u00a0990")).toBe(1990);
    expect(numberShownBy("12\u202f500\u202f000")).toBe(12_500_000);
    expect(numberShownBy("2,5")).toBe(2.5);
    expect(numberShownBy("2.5")).toBe(2.5);
    expect(numberShownBy("\u22123")).toBe(-3);
  });

  it("reads no number from other words", () => {
    expect(numberShownBy("240 ₽")).toBeUndefined();
    expect(numberShownBy("от 240")).toBeUndefined();
    expect(numberShownBy("19 90")).toBeUndefined();
    expect(numberShownBy("")).toBeUndefined();
  });
});

describe("canTypeValueInPlace", () => {
  it("types a number its element shows alone, with spaces or a comma", () => {
    expect(
      canTypeValueInPlace(shown("240"), { kind: "number", value: 240 }),
    ).toBe(true);
    expect(
      canTypeValueInPlace(shown("1&nbsp;990"), { kind: "number", value: 1990 }),
    ).toBe(true);
    expect(
      canTypeValueInPlace(shown("2,5"), { kind: "number", value: 2.5 }),
    ).toBe(true);
  });

  it("refuses a number the element shows with a unit, otherwise, or with another field", () => {
    expect(
      canTypeValueInPlace(shown("240 ₽"), { kind: "number", value: 240 }),
    ).toBe(false);
    expect(
      canTypeValueInPlace(shown("250"), { kind: "number", value: 240 }),
    ).toBe(false);
    expect(
      canTypeValueInPlace(shown('<b data-cms-path="menu.0.unit">240</b>'), {
        kind: "number",
        value: 240,
      }),
    ).toBe(false);
  });

  it("types a time its element shows as it is", () => {
    expect(
      canTypeValueInPlace(shown("19:00"), { kind: "time", value: "19:00" }),
    ).toBe(true);
    expect(
      canTypeValueInPlace(shown("с 19:00"), { kind: "time", value: "19:00" }),
    ).toBe(false);
  });
});
