import type { FeedOffer } from "./offers";
import { escapeXml, textElement, XML_DECLARATION } from "./xml";

// The catalog as an Avito autoload file: an ad for every product with a price. What Avito asks
// besides the words, the price and the photos depends on the category (a «GoodsType», a «Condition»,
// the size of a house): the site gives those fields itself, from its own content or as constants.

export interface AvitoSeller {
  /** Where the goods are: the address of the shop or the workshop. */
  readonly address: string;
  readonly contactPhone: string;
  /** The category of Avito the ads go to: «Ремонт и строительство». */
  readonly category: string;
}

/** Avito shows a title up to 50 characters and up to 10 photos of an ad. */
const TITLE_LENGTH = 50;
const MOST_IMAGES = 10;
const DESCRIPTION_LENGTH = 7500;

export function avitoFeedOf(
  seller: AvitoSeller,
  offers: readonly FeedOffer[],
  fieldsOf: (offer: FeedOffer) => Readonly<Record<string, string>> = () => ({}),
): string {
  const priced = offers.filter((offer) => (offer.price ?? 0) > 0);
  const ads = priced.map((offer) => adOf(seller, offer, fieldsOf(offer)));
  return [
    XML_DECLARATION,
    '<Ads formatVersion="3" target="Avito.ru">',
    ...ads,
    "</Ads>",
  ].join("\n");
}

function adOf(
  seller: AvitoSeller,
  offer: FeedOffer,
  fields: Readonly<Record<string, string>>,
): string {
  const images = offer.pictures
    .slice(0, MOST_IMAGES)
    .map((picture) => `<Image url="${escapeXml(picture)}"/>`);
  const extra = Object.entries(fields).map(([name, value]) =>
    textElement(name, value),
  );
  return [
    "<Ad>",
    textElement("Id", offer.id),
    textElement("Address", seller.address),
    textElement("Category", seller.category),
    textElement("Title", titleOf(offer.name)),
    textElement("Description", offer.description.slice(0, DESCRIPTION_LENGTH)),
    textElement("Price", String(offer.price)),
    textElement("ContactPhone", seller.contactPhone),
    images.length === 0 ? "" : `<Images>${images.join("")}</Images>`,
    ...extra,
    "</Ad>",
  ].join("");
}

const GRAPHEMES = new Intl.Segmenter("ru-RU", { granularity: "grapheme" });

/** The name as Avito shows it, cut at a word to fit. */
function titleOf(name: string): string {
  const characters = Array.from(
    GRAPHEMES.segment(name.trim()),
    ({ segment }) => segment,
  );
  const cut = characters.slice(0, TITLE_LENGTH).join("");
  const isWhole = characters.length <= TITLE_LENGTH;
  if (isWhole) return cut;
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}
