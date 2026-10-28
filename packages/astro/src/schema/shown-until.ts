import { date, type DateField } from "./fields";

// A record shown until a day, an offer that ends on Sunday: the owner sets the last day it is
// shown, and the site leaves it out from the day after, with nobody pressing anything. A site
// rendered on request checks it on every visit; a static one only when it is built again.

/** The last day a record or a block is shown on the site; empty, it is shown without an end. */
export function shownUntilField(
  options: { readonly label?: string } = {},
): DateField {
  return date({ label: options.label ?? "Показывать до" });
}

/**
 * Whether a record is still shown on a day, both written as a date of the content
 * ("2026-11-01"): up to and including its last day, and always when it has none.
 */
export function isShownOn(shownUntil: string | null, day: string): boolean {
  if (shownUntil === null || shownUntil === "") return true;
  return day <= shownUntil;
}

/**
 * The day it is at a moment where the business is, as a date of the content: a site in Kirov
 * passes "Europe/Kirov", so an offer ends at the business's midnight, not the server's.
 */
export function calendarDayIn(timeZone: string, moment: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(moment);
  const partOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${partOf("year")}-${partOf("month")}-${partOf("day")}`;
}
