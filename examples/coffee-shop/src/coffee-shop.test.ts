import { parseContent, richTextOf } from "@seamlet/astro/schema";
import { describe, expect, it } from "vitest";
import { formatEventDate, formatPrice, hasWords, phoneHref } from "./format";
import { coffeeShopInitialContent } from "./initial-content";
import { coffeeShopSchema } from "./schema";

describe("the coffee shop content", () => {
  it("starts with content that the CMS can save as it is", () => {
    expect(
      parseContent(coffeeShopSchema, coffeeShopInitialContent).issues,
    ).toEqual([]);
  });
});

describe("hasWords", () => {
  it("finds words in a formatted text and none in an emptied one", () => {
    expect(hasWords(richTextOf("Двойная порция"))).toBe(true);
    expect(hasWords(richTextOf("   "))).toBe(false);
    expect(hasWords([])).toBe(false);
  });
});

describe("formatPrice", () => {
  it("groups thousands the Russian way and adds the rouble sign", () => {
    expect(formatPrice(150)).toBe("150 ₽");
    expect(formatPrice(1500)).toBe("1\u00a0500 ₽");
  });
});

describe("formatEventDate", () => {
  it("names the day and the month in Russian", () => {
    expect(formatEventDate("2026-10-24")).toBe("24 октября");
    expect(formatEventDate("2027-01-01")).toBe("1 января");
  });
});

describe("phoneHref", () => {
  it("keeps only what a tel: link needs", () => {
    expect(phoneHref("+7 (000) 000-00-00")).toBe("tel:+70000000000");
  });
});
