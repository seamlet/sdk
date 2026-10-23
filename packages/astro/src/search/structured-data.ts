import { productDescriptionOf, type ProductRecord } from "../feeds/offers";
import {
  linkTargetOf,
  plainTextOf,
  type contactsFields,
  type openingHoursField,
  type RichText,
  type ValueOf,
} from "../schema";

// Structured data (schema.org in JSON-LD): what a page tells search engines and AI assistants
// in their own terms, so they show the business's hours, a product's price or a page's questions
// as facts and not as words to guess from. Each builder takes the content a preset holds and
// leaves out what the owner left empty: a property with no value says nothing true.

/** A value of a property of structured data. */
export type StructuredValue =
  string | number | boolean | StructuredNode | readonly StructuredValue[];

/** A thing of schema.org: its type and its properties. */
export interface StructuredNode {
  readonly "@type": string;
  readonly [property: string]: StructuredValue;
}

const SCHEMA_ORG = "https://schema.org";
const PRICE_CURRENCY = "RUB";
/** What `@id` adds to the address of the page a thing is described on. */
const BUSINESS_ID = "#business";
const PRODUCT_ID = "#product";
const HOME_PATH = "/";
/** The first item of a list in schema.org is at position 1. */
const FIRST_POSITION = 1;

/** The days of `openingHoursField` as schema.org names them. */
const DAYS_OF_WEEK = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
} as const;

export type OpeningHoursRows = ValueOf<ReturnType<typeof openingHoursField>>;
export type ContactsValue = ValueOf<ReturnType<typeof contactsFields>>;

/** An address in parts, when the site knows them: the city apart from the street. */
export interface PostalAddressSource {
  readonly streetAddress: string;
  readonly addressLocality?: string;
  readonly addressRegion?: string;
  readonly postalCode?: string;
  /** Two letters: `RU`. */
  readonly addressCountry?: string;
}

export interface LocalBusinessSource {
  /**
   * The type of schema.org the business is: `LocalBusiness`, or a more exact one, such as
   * `CafeOrCoffeeShop`, `Restaurant`, `Florist`, `HomeAndConstructionBusiness`, `BeautySalon`.
   */
  readonly type?: string;
  readonly name: string;
  /** The whole address of the site: `https://example.ru`. */
  readonly url: string;
  readonly description?: string;
  readonly telephone?: string;
  readonly email?: string;
  /** One line, `Киров, ул. Ленина, 1`, or the address in parts. */
  readonly address?: string | PostalAddressSource;
  readonly openingHours?: OpeningHoursRows;
  /** Photos of the business, by addresses of the site or whole ones. */
  readonly images?: readonly string[];
  readonly logo?: string;
  /** The business's pages elsewhere: a group of a social network, a page on maps. */
  readonly sameAs?: readonly string[];
  /** A link to the business on a map. */
  readonly hasMap?: string;
  /** How expensive it is: `₽₽`, or `500–1500 ₽`. */
  readonly priceRange?: string;
  /** Where the business works: `Киров и область`. */
  readonly areaServed?: string;
  readonly geo?: { readonly latitude: number; readonly longitude: number };
}

/**
 * The business behind the site, for every page of it: `LocalBusiness` or the type the site names,
 * with its contacts and hours. `businessContactsOf` reads them from `contactsFields()`.
 */
export function localBusinessOf(source: LocalBusinessSource): StructuredNode {
  const homeUrl = new URL(HOME_PATH, source.url).href;
  const images = (source.images ?? [])
    .filter(hasWords)
    .map((src) => new URL(src, source.url).href);
  const hours = openingHoursSpecificationOf(source.openingHours ?? []);
  return {
    "@type": source.type ?? "LocalBusiness",
    "@id": `${homeUrl}${BUSINESS_ID}`,
    name: source.name,
    url: homeUrl,
    ...textProperties({
      description: source.description,
      telephone: source.telephone,
      email: source.email,
      priceRange: source.priceRange,
      areaServed: source.areaServed,
      hasMap: source.hasMap,
    }),
    ...addressProperty(source.address),
    ...(images.length === 0 ? {} : { image: images }),
    ...logoProperty(source.logo, source.url),
    ...listProperty("sameAs", (source.sameAs ?? []).filter(hasWords)),
    ...listProperty("openingHoursSpecification", hours),
    ...geoProperty(source.geo),
  };
}

/**
 * The phone, the address, the map and the messengers of `contactsFields()` as properties of a
 * business: `localBusinessOf({ type, name, url, ...businessContactsOf(content.contacts) })`.
 */
export function businessContactsOf(
  contacts: ContactsValue,
): Pick<LocalBusinessSource, "telephone" | "address" | "hasMap" | "sameAs"> {
  const telephone = telephoneOf(contacts.phone);
  const sameAs = contacts.messengers.flatMap(({ link }) => {
    const target = link === null ? undefined : linkTargetOf(link.href);
    return target?.kind === "web" ? [target.url] : [];
  });
  return {
    ...(telephone === undefined ? {} : { telephone }),
    ...(hasWords(contacts.address) ? { address: contacts.address } : {}),
    ...(contacts.map === null ? {} : { hasMap: contacts.map }),
    sameAs,
  };
}

/** The rows of `openingHoursField()` with days and both times, as schema.org writes hours. */
export function openingHoursSpecificationOf(
  rows: OpeningHoursRows,
): StructuredNode[] {
  return rows.flatMap(({ days, opens, closes }) => {
    // A row of a note alone, such as «Выходной», says no hours.
    if (days.length === 0 || opens === null || closes === null) return [];

    return [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: days.map((day) => DAYS_OF_WEEK[day]),
        opens,
        closes,
      },
    ];
  });
}

/** Whether a product can be bought now, in the words of schema.org. */
export type ProductAvailability =
  | "InStock"
  | "OutOfStock"
  | "PreOrder"
  | "BackOrder"
  | "MadeToOrder"
  | "InStoreOnly"
  | "LimitedAvailability";

export interface ProductStructureOptions {
  /** The whole address of the product's page. */
  readonly url: string;
  /** In stock when left out. */
  readonly availability?: ProductAvailability;
  /**
   * The prices it is sold at, in rubles, when there are several (sizes, kinds); its `price` when
   * left out. Several prices are a range from the lowest to the highest.
   */
  readonly prices?: readonly number[];
  /** The name of its category in the site's catalog. */
  readonly category?: string;
  readonly brand?: string;
}

/**
 * A product of `productFields()` for its page: its name, description, photos and its price in
 * rubles. A product without a price has no offer.
 */
export function productOf(
  product: ProductRecord,
  options: ProductStructureOptions,
): StructuredNode {
  const images = product.photos.flatMap(({ photo }) =>
    photo === null || !hasWords(photo.src)
      ? []
      : [new URL(photo.src, options.url).href],
  );
  const offer = offerOf(product, options);
  return {
    "@type": "Product",
    "@id": `${options.url}${PRODUCT_ID}`,
    name: product.name,
    url: options.url,
    ...textProperties({
      description: productDescriptionOf(product),
      sku: product.id,
      category: options.category,
    }),
    ...(images.length === 0 ? {} : { image: images }),
    ...(hasWords(options.brand)
      ? { brand: { "@type": "Brand", name: options.brand } }
      : {}),
    ...(offer === undefined ? {} : { offers: offer }),
  };
}

function offerOf(
  product: ProductRecord,
  options: ProductStructureOptions,
): StructuredNode | undefined {
  const prices =
    options.prices ?? (product.price === null ? [] : [product.price]);
  if (prices.length === 0) return undefined;

  const availability = `${SCHEMA_ORG}/${options.availability ?? "InStock"}`;
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);
  const isOnePrice = lowPrice === highPrice;
  const terms = {
    priceCurrency: PRICE_CURRENCY,
    availability,
    url: options.url,
  };
  return isOnePrice
    ? { "@type": "Offer", price: lowPrice, ...terms }
    : {
        "@type": "AggregateOffer",
        lowPrice,
        highPrice,
        offerCount: prices.length,
        ...terms,
      };
}

/** A step of the way to a page: its name and its whole address. */
export interface Breadcrumb {
  readonly name: string;
  readonly url: string;
}

/** The way from the home page to this one, the home page first and this page last. */
export function breadcrumbsOf(crumbs: readonly Breadcrumb[]): StructuredNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + FIRST_POSITION,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/** A question of a page and its answer, plain or formatted. */
export interface QuestionSource {
  readonly question: string;
  readonly answer: string | RichText;
}

/**
 * The questions a page answers, such as a collection of a question and an answer: undefined when
 * none has both, as a page of no questions is not a FAQ.
 */
export function faqPageOf(
  questions: readonly QuestionSource[],
): StructuredNode | undefined {
  const answered = questions.flatMap(({ question, answer }) => {
    const text = typeof answer === "string" ? answer : plainTextOf(answer);
    const isAnswered = hasWords(question) && hasWords(text);
    if (!isAnswered) return [];

    const acceptedAnswer = { "@type": "Answer", text: text.trim() };
    return [{ "@type": "Question", name: question.trim(), acceptedAnswer }];
  });
  if (answered.length === 0) return undefined;

  return { "@type": "FAQPage", mainEntity: answered };
}

/** `<`, `>` and `&` written as JSON escapes, and the line separators JavaScript reads as ends. */
const UNSAFE_IN_SCRIPT = /[<>&\u2028\u2029]/gu;
const HEX = 16;
const ESCAPE_DIGITS = 4;

/**
 * The text of a `<script type="application/ld+json">` of the things, or undefined when there are
 * none. Several things go in one `@graph`. No word of the content can close the element: `<` is
 * written as `<`, which JSON reads back as the same character.
 */
export function structuredDataText(
  things: StructuredNode | readonly (StructuredNode | undefined)[],
): string | undefined {
  const nodes = isNodeList(things)
    ? things.filter((node) => node !== undefined)
    : [things];
  const [first, ...others] = nodes;
  if (first === undefined) return undefined;

  const document =
    others.length === 0
      ? { "@context": SCHEMA_ORG, ...first }
      : { "@context": SCHEMA_ORG, "@graph": nodes };
  return JSON.stringify(document).replace(UNSAFE_IN_SCRIPT, (character) => {
    const code = character.charCodeAt(0).toString(HEX);
    return `\\u${code.padStart(ESCAPE_DIGITS, "0")}`;
  });
}

function isNodeList(
  things: StructuredNode | readonly (StructuredNode | undefined)[],
): things is readonly (StructuredNode | undefined)[] {
  return Array.isArray(things);
}

function telephoneOf(phone: ContactsValue["phone"]): string | undefined {
  if (phone === null) return undefined;

  const target = linkTargetOf(phone.href);
  const number = target?.kind === "phone" ? target.number : phone.text;
  return hasWords(number) ? number.trim() : undefined;
}

/** The properties that have words, each trimmed. */
function textProperties(
  properties: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const filled = Object.entries(properties).flatMap(([name, value]) =>
    hasWords(value) ? [[name, value.trim()] as const] : [],
  );
  return Object.fromEntries(filled);
}

function addressProperty(
  address: LocalBusinessSource["address"],
): Record<string, StructuredNode> {
  if (address === undefined) return {};

  const parts =
    typeof address === "string" ? { streetAddress: address } : address;
  if (!hasWords(parts.streetAddress)) return {};

  return {
    address: { "@type": "PostalAddress", ...textProperties({ ...parts }) },
  };
}

function logoProperty(
  logo: string | undefined,
  siteUrl: string,
): Record<string, string> {
  return hasWords(logo) ? { logo: new URL(logo, siteUrl).href } : {};
}

function geoProperty(
  geo: LocalBusinessSource["geo"],
): Record<string, StructuredNode> {
  return geo === undefined
    ? {}
    : { geo: { "@type": "GeoCoordinates", ...geo } };
}

function listProperty(
  name: string,
  values: readonly StructuredValue[],
): Record<string, readonly StructuredValue[]> {
  return values.length === 0 ? {} : { [name]: values };
}

function hasWords(text: string | undefined): text is string {
  return text !== undefined && text.trim() !== "";
}
