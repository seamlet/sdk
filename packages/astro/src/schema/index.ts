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
export { resolveFieldPath, type FieldTarget } from "./field-paths";
export {
  collectionAt,
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
  normalizedLine,
  plainTextOf,
  readRichText,
  richTextOf,
  type RichBlock,
  type RichLine,
  type RichSpan,
  type RichText,
} from "./rich-text";
export { readFields } from "./read-fields";
export {
  isSearchTextsGroup,
  readSiteDescription,
  SITE_DESCRIPTION_PATH,
  type SiteDescription,
  type SitePageDescription,
} from "./site-description";
