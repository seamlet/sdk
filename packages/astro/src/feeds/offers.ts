import { plainTextOf, type ContentOf, type RecordOf } from "../schema";
import type { productFields } from "../schema";

// What a feed tells of a product: the same words for Яндекс and Avito, taken once from the site's
// content. A site whose products are `productFields` gets them with productOffersOf; any other
// site makes its offers from its own fields.

export interface FeedOffer {
  /** Stays the same while the product lives: the record's id. */
  readonly id: string;
  readonly name: string;
  /** The whole address of the product's page, or of the catalog when products have no pages. */
  readonly url: string;
  /** In rubles; a product without a price is left out of the feeds, which require one. */
  readonly price: number | null;
  readonly description: string;
  /** Whole addresses of its photos, the main one first. */
  readonly pictures: readonly string[];
  /** The name of its category, if the catalog has them. */
  readonly category?: string;
}

export type ProductRecord = RecordOf<ReturnType<typeof productFields>>;

export interface ProductOffersOptions {
  /** The site's address: `https://example.ru`. */
  readonly siteUrl: string;
  /** The page of a product (`recordPages(...).pathOf`), or none: the catalog's page is used. */
  readonly pathOf?: (product: ProductRecord) => string | undefined;
  /** The page of the catalog, for products without pages of their own. */
  readonly catalogPath?: string;
  readonly categoryOf?: (product: ProductRecord) => string | undefined;
}

/** The offers of the products a visitor sees: hidden ones and ones without an id are left out. */
export function productOffersOf(
  products: readonly ProductRecord[],
  options: ProductOffersOptions,
): readonly FeedOffer[] {
  return products.flatMap((product) => {
    const id = product.id;
    if (product.isHidden || id === undefined) return [];
    return [offerOf(product, id, options)];
  });
}

function offerOf(
  product: ProductRecord,
  id: string,
  options: ProductOffersOptions,
): FeedOffer {
  const path = options.pathOf?.(product) ?? options.catalogPath ?? "/";
  const photos = product.photos.flatMap(({ photo }) =>
    photo === null || photo.src.trim() === "" ? [] : [photo.src],
  );
  const description = descriptionOf(product);
  const category = options.categoryOf?.(product);
  return {
    id,
    name: product.name,
    url: new URL(path, options.siteUrl).href,
    price: product.price,
    description,
    pictures: photos.map((src) => new URL(src, options.siteUrl).href),
    ...(category === undefined ? {} : { category }),
  };
}

/** The whole description, or the short line when the product has none. */
function descriptionOf(
  product: ContentOf<ReturnType<typeof productFields>>,
): string {
  const whole = plainTextOf(product.description).trim();
  return whole === "" ? plainTextOf(product.summary).trim() : whole;
}
