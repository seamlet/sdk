// How the coffee shop shows its values: the site's own logic, the CMS knows nothing about it.

const PRICE_FORMAT = new Intl.NumberFormat("ru-RU");
// A content date is a calendar day, so it is read and shown in UTC: no time zone can shift the day.
const EVENT_DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function formatPrice(price: number): string {
  return `${PRICE_FORMAT.format(price)} ₽`;
}

/** `2026-10-24` → «24 октября». */
export function formatEventDate(date: string): string {
  return EVENT_DATE_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

/** A `tel:` link keeps only the digits and the leading plus of a phone written for people. */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/gu, "")}`;
}
