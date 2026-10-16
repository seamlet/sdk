// The public API of the schema language: everything a site needs to describe and render its
// content. A site imports it as `@seamlet/astro/schema`; the CMS checks and stores content with the
// same code.
export {
  collection,
  date,
  defineSchema,
  group,
  image,
  link,
  number,
  text,
  type CollectionField,
  type DateField,
  type Field,
  type FieldKind,
  type Fields,
  type GroupField,
  type ImageField,
  type LinkField,
  type NumberField,
  type TextField,
} from "./fields";
export {
  defaultContent,
  defaultValue,
  type Content,
  type ContentOf,
  type FieldValue,
  type ImageValue,
  type LinkValue,
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
  hrefOf,
  linkTargetOf,
  type LinkKind,
  type LinkTarget,
} from "./link-addresses";
