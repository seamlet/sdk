// The public API of the schema language: everything a site needs to describe and render its
// content. A site imports it as `@seamlet/astro/schema`; the CMS checks and stores content with the
// same code.
export {
  choice,
  choices,
  collection,
  date,
  defineSchema,
  group,
  image,
  link,
  number,
  reference,
  references,
  richText,
  slug,
  text,
  time,
  toggle,
  url,
  type ChoiceField,
  type ChoiceOption,
  type ChoicesField,
  type CollectionField,
  type DateField,
  type Field,
  type FieldKind,
  type Fields,
  type GroupField,
  type ImageField,
  type LinkField,
  type NumberField,
  type RecordFields,
  type ReferenceField,
  type ReferencesField,
  type RichTextField,
  type SlugField,
  type TextField,
  type TimeField,
  type ToggleField,
  type UrlField,
} from "./fields";
export {
  defaultContent,
  defaultValue,
  type Content,
  type ContentOf,
  type FieldValue,
  type ImageFocus,
  type ImageValue,
  type LinkValue,
  type OptionValue,
  type RecordOf,
  type ValueOf,
} from "./content";
export {
  countCharacters,
  formatFieldPath,
  parseContent,
  type ContentIssue,
  type FieldPath,
  type ParsedContent,
} from "./parse-content";
export {
  editable,
  FIELD_PATH_ATTRIBUTE,
  type ContentPath,
  type FieldMarker,
} from "./field-markers";
export {
  FIELD_PATH_SEPARATOR,
  resolveFieldPath,
  type FieldTarget,
} from "./field-paths";
export {
  collectionAt,
  collectionFieldAt,
  findRecord,
  isRecordId,
  newRecord,
  RECORD_ID_KEY,
  withRecordIds,
  type CollectionRecords,
} from "./record-ids";
export {
  REVEAL_ATTRIBUTE,
  REVEAL_EVENT,
  REVEALED_ATTRIBUTE,
} from "./reveal-markers";
export {
  hrefOf,
  linkTargetOf,
  safeHref,
  type LinkKind,
  type LinkTarget,
} from "./link-addresses";
export { imagePosition } from "./image-position";
export {
  contactsFields,
  openingHoursField,
  seoFields,
  WEEKDAYS,
} from "./presets";
export {
  asOneParagraph,
  linesOf,
  normalizedLine,
  plainTextOf,
  readRichText,
  richTextOf,
  type RichBlock,
  type RichLine,
  type RichSpan,
  type RichText,
} from "./rich-text";
export { isContentObject, isJsonObject, type JsonObject } from "./json-values";
export {
  checkFields,
  readFields,
  type FieldsReading,
  type SchemaProblem,
  type SchemaProblemReason,
} from "./read-fields";
export {
  isSiteId,
  readSiteConfig,
  SITE_CONFIG_FILE,
  type SiteConfig,
  type SiteConfigField,
  type SiteConfigReading,
} from "./site-config";
export {
  checkSiteDescription,
  HOME_PAGE_PATH,
  isSearchTextsGroup,
  readSiteDescription,
  SITE_DESCRIPTION_PATH,
  type PageProblemReason,
  type RecordPageProblemReason,
  type SiteDescription,
  type SiteDescriptionProblem,
  type SiteDescriptionReading,
  type SitePageDescription,
} from "./site-description";
export {
  isRecordPagePath,
  PAGE_PATH_SEPARATOR,
  RECORD_PLACEHOLDER,
  recordAddressOf,
  recordAt,
  recordPageAt,
  recordPagePath,
  recordPages,
  type CollectionPath,
  type PlacedRecord,
  type RecordFieldsAt,
  type RecordPagePath,
  type RecordPages,
  type SiteRecordPageDescription,
} from "./record-pages";
export { isSlug, MAX_SLUG_LENGTH, slugOf } from "./slugs";
export { slugFieldOf } from "./slug-checks";
