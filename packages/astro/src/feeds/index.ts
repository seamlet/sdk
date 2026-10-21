// Feeds of a site's catalog for the places that sell it: Яндекс (YML) and Avito. A site serves them
// from its own build, from its published content: `src/pages/feeds/yandex.xml.ts`.

export { avitoFeedOf, type AvitoSeller } from "./avito-feed";
export {
  productOffersOf,
  type FeedOffer,
  type ProductOffersOptions,
  type ProductRecord,
} from "./offers";
export { yandexFeedOf, type YandexShop } from "./yandex-feed";
