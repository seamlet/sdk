// What makes a site found by search engines and AI assistants: `@seamlet/astro/search`. The
// integration serves the sitemap, robots.txt and llms.txt with these; a site renders the structured
// data of its pages with `components/StructuredData.astro` and the builders here.

export {
  llmsTxtOf,
  type LlmsPage,
  type LlmsSection,
  type LlmsSource,
} from "./llms-txt";
export { robotsTxtOf, SEARCH_CRAWLERS, type RobotsSource } from "./robots";
export { sitemapOf } from "./sitemap";
export {
  breadcrumbsOf,
  businessContactsOf,
  faqPageOf,
  localBusinessOf,
  openingHoursSpecificationOf,
  productOf,
  structuredDataText,
  type Breadcrumb,
  type ContactsValue,
  type LocalBusinessSource,
  type OpeningHoursRows,
  type PostalAddressSource,
  type ProductAvailability,
  type ProductStructureOptions,
  type QuestionSource,
  type StructuredNode,
  type StructuredValue,
} from "./structured-data";
