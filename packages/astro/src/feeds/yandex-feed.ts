import type { FeedOffer } from "./offers";
import { escapeXml, textElement, XML_DECLARATION } from "./xml";

// The catalog in YML, the format Яндекс takes products in: Яндекс Директ for product ads, Яндекс
// Бизнес and Яндекс Маркет. Only what every offer has is written; a product without a price is
// left out, as Яндекс refuses it.

export interface YandexShop {
  /** The short name buyers know: «Лесная мастерская». */
  readonly name: string;
  /** The company's full name: «ООО «Лесная мастерская»». */
  readonly company: string;
  /** The site's address. */
  readonly url: string;
}

/** Яндекс takes an offer's id of Latin letters and digits, up to 20 of them. */
const OFFER_ID_LENGTH = 20;
const NOT_OFFER_ID = /[^A-Za-z0-9]/gu;
const DESCRIPTION_LENGTH = 3000;
/** A catalog without categories puts its offers in one named after the shop. */
const SHOP_CATEGORY_ID = "1";

export function yandexFeedOf(
  shop: YandexShop,
  offers: readonly FeedOffer[],
  madeAt: Date,
): string {
  const priced = offers.filter((offer) => (offer.price ?? 0) > 0);
  const categories = categoryIdsOf(priced, shop.name);
  const offerElements = priced.map((offer) =>
    offerElementOf(
      offer,
      categories.get(offer.category ?? shop.name) ?? SHOP_CATEGORY_ID,
    ),
  );
  const categoryElements = [...categories].map(
    ([name, id]) => `<category id="${id}">${escapeXml(name)}</category>`,
  );
  return [
    XML_DECLARATION,
    `<yml_catalog date="${dateOf(madeAt)}">`,
    "<shop>",
    textElement("name", shop.name),
    textElement("company", shop.company),
    textElement("url", shop.url),
    '<currencies><currency id="RUB" rate="1"/></currencies>',
    `<categories>${categoryElements.join("")}</categories>`,
    `<offers>${offerElements.join("")}</offers>`,
    "</shop>",
    "</yml_catalog>",
  ].join("\n");
}

/** Every category the offers name, numbered in the order they come. */
function categoryIdsOf(
  offers: readonly FeedOffer[],
  shopName: string,
): ReadonlyMap<string, string> {
  const names = offers.map((offer) => offer.category ?? shopName);
  const unique = [...new Set(names)];
  return new Map(unique.map((name, index) => [name, String(index + 1)]));
}

function offerElementOf(offer: FeedOffer, categoryId: string): string {
  const pictures = offer.pictures.map((picture) =>
    textElement("picture", picture),
  );
  const description = offer.description.slice(0, DESCRIPTION_LENGTH);
  return [
    `<offer id="${offerIdOf(offer.id)}" available="true">`,
    textElement("name", offer.name),
    textElement("url", offer.url),
    textElement("price", String(offer.price)),
    "<currencyId>RUB</currencyId>",
    textElement("categoryId", categoryId),
    ...pictures,
    description === "" ? "" : textElement("description", description),
    "</offer>",
  ].join("");
}

function offerIdOf(id: string): string {
  return id.replace(NOT_OFFER_ID, "").slice(0, OFFER_ID_LENGTH);
}

/** The moment as Яндекс reads it: `2026-10-21T21:00:00Z`, without fractions of a second. */
function dateOf(moment: Date): string {
  return `${moment.toISOString().slice(0, 19)}Z`;
}
