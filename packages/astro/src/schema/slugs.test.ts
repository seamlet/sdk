import { describe, expect, it } from "vitest";
import { isSlug, MAX_SLUG_LENGTH, slugOf } from "./slugs";

describe("slugOf", () => {
  it("spells Russian words the way addresses of Russian sites do", () => {
    expect(slugOf("Баня из бруса 6×4")).toBe("banya-iz-brusa-6x4");
    expect(slugOf("Щётка, жёсткая — №2")).toBe("schetka-zhestkaya-no2");
    expect(slugOf("Чай «Юность»")).toBe("chay-yunost");
    expect(slugOf("Подъезд и объём")).toBe("podezd-i-obem");
  });

  it("spells the letters of Ukrainian and Belarusian words too", () => {
    expect(slugOf("Їжак і ґанок")).toBe("yizhak-i-ganok");
  });

  it("keeps Latin letters without their accents, and digits", () => {
    expect(slugOf("Crème brûlée 2026")).toBe("creme-brulee-2026");
  });

  it("gives nothing for words without a letter or a digit", () => {
    expect(slugOf(" — «» ")).toBe("");
  });

  it("stops short of the limit at a hyphen, never in the middle of a word", () => {
    const words = Array.from({ length: 30 }, () => "слово").join(" ");
    const slug = slugOf(words);

    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith("slovo")).toBe(true);
  });

  it("keeps a word that ends right at the limit", () => {
    const first = "a".repeat(39);
    const second = "b".repeat(40);

    expect(slugOf(`${first} ${second} ccc`)).toBe(`${first}-${second}`);
  });
});

describe("isSlug", () => {
  it("takes the letters of a page's address only", () => {
    expect(isSlug("banya-6x4")).toBe(true);
    expect(isSlug("Latte")).toBe(false);
    expect(isSlug("латте")).toBe(false);
    expect(isSlug("-latte")).toBe(false);
    expect(isSlug("menu/latte")).toBe(false);
    expect(isSlug("")).toBe(false);
  });
});
