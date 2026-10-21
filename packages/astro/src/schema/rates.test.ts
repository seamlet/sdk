import { describe, expect, it } from "vitest";
import { defaultContent, defineSchema, parseContent } from "./index";
import { estimateOf, ratesField, type Rate } from "./rates";

const rates: readonly Rate[] = [
  { id: "timber", name: "Брус 150×150", unit: "м³", price: 32000 },
  { id: "roof", name: "Кровля", unit: "м²", price: 1250.5 },
  { id: "stove", name: "Печь", unit: "шт", price: null },
];

describe("ratesField", () => {
  it("is a collection the owner fills like any other", () => {
    const schema = defineSchema({ rates: ratesField() });

    expect(defaultContent(schema)).toEqual({ rates: [] });
    expect(parseContent(schema, { rates }).issues).toEqual([]);
  });
});

describe("estimateOf", () => {
  it("sums the amounts at their rates in whole rubles", () => {
    expect(estimateOf(rates, { timber: 2.5, roof: 3 })).toBe(83752);
  });

  it("adds nothing for a rate without a price, an unknown rate or a wrong amount", () => {
    expect(
      estimateOf(rates, { stove: 1, sauna: 5, timber: -1, roof: Number.NaN }),
    ).toBe(0);
  });
});
