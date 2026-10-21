import type { RecordOf } from "./content";
import { collection, number, text } from "./fields";

// A calculator whose prices the owner keeps: the rates are content («Брус 150×150 — 32 000 ₽ за
// м³»), the site's own code asks what a visitor wants and shows the sum. A new price reaches the
// calculator with the next publication, without the developer.

/** The rates of a calculator: what is counted, in what unit and at what price. */
export function ratesField(options: { readonly label?: string } = {}) {
  return collection({
    label: options.label ?? "Расценки калькулятора",
    itemTitle: "name",
    item: {
      name: text({ label: "Что считаем", maxLength: 80 }),
      unit: text({ label: "Единица", maxLength: 12 }),
      price: number({ label: "Цена за единицу, ₽", min: 0 }),
    },
  });
}

export type Rate = RecordOf<ReturnType<typeof ratesField>["item"]>;

/**
 * The sum of the amounts a visitor chose at the rates, in whole rubles. An amount is known by the
 * id of its rate; a rate without a price, an amount of no rate and an amount below zero add
 * nothing.
 */
export function estimateOf(
  rates: readonly Rate[],
  amounts: Readonly<Record<string, number>>,
): number {
  const total = rates.reduce((sum, rate) => {
    const price = rate.price ?? 0;
    const amount = rate.id === undefined ? 0 : (amounts[rate.id] ?? 0);
    const isCounted = Number.isFinite(amount) && amount > 0;
    return isCounted ? sum + amount * price : sum;
  }, 0);
  return Math.round(total);
}
