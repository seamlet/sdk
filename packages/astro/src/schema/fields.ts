// The schema language: a site describes its editable content with these fields. A schema is plain
// data that survives JSON, so the editor gets it as data, while the site gets the types of its
// content from the same object (see ContentOf).

export interface TextField {
  readonly kind: "text";
  readonly label: string;
  /** A textarea instead of a single line. */
  readonly multiline?: boolean;
  /** In characters as people see them (see countCharacters), not UTF-16 units. */
  readonly maxLength?: number;
}

/**
 * A text with paragraphs, lists, bold, italic and links inside it: a paragraph with a link in a
 * sentence stays one field. `inline` keeps it one paragraph without lists, for a text inside an
 * element that holds one line of words.
 */
export interface RichTextField {
  readonly kind: "richText";
  readonly label: string;
  readonly inline?: boolean;
  /** In characters of its words as people see them, without the marks. */
  readonly maxLength?: number;
}

export interface NumberField {
  readonly kind: "number";
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
}

/** A calendar date without time, stored as `YYYY-MM-DD`. */
export interface DateField {
  readonly kind: "date";
  readonly label: string;
}

/** An image address with its alternative text. */
export interface ImageField {
  readonly kind: "image";
  readonly label: string;
}

/**
 * A document a visitor opens or downloads: a price list, a menu, a contract, uploaded in the CMS as
 * a PDF. Its value is the file's address and the name the site shows for it.
 */
export interface FileField {
  readonly kind: "file";
  readonly label: string;
}

/**
 * A link: its text and where it leads (a page of the site, another site, a phone or an email).
 * The site decides how it looks; a button «Записаться» stays a button.
 */
export interface LinkField {
  readonly kind: "link";
  readonly label: string;
}

/** Yes or no, for example «Можно новичкам» or «Скрыть с сайта». */
export interface ToggleField {
  readonly kind: "toggle";
  readonly label: string;
}

/** One of the options a person picks from, as the site names it and as the editor shows it. */
export interface ChoiceOption {
  /** What the content stores and the site reads; never shown to people. */
  readonly value: string;
  /** What the editor shows. */
  readonly label: string;
}

/** One option of a fixed list, or none: a level, a category, a badge. */
export interface ChoiceField<
  O extends readonly ChoiceOption[] = readonly ChoiceOption[],
> {
  readonly kind: "choice";
  readonly label: string;
  readonly options: O;
}

/** Any number of options of a fixed list: tags, the days a class runs. */
export interface ChoicesField<
  O extends readonly ChoiceOption[] = readonly ChoiceOption[],
> {
  readonly kind: "choices";
  readonly label: string;
  readonly options: O;
}

/** A web address without a text: a booking widget, a map. Only `http://` and `https://`. */
export interface UrlField {
  readonly kind: "url";
  readonly label: string;
}

/** A time of day without a date, stored as `HH:MM` (24 hours). */
export interface TimeField {
  readonly kind: "time";
  readonly label: string;
}

/**
 * Where a record's page is on the site: `latte` puts it at `/menu/latte` (see recordPages). Lower-case
 * Latin letters, digits and hyphens, one of a kind in its collection; left empty, the page is at the
 * record's id. A field of a record of a collection, one per record.
 */
export interface SlugField {
  readonly kind: "slug";
  readonly label: string;
}

/**
 * A record of a collection of the schema, by its id: the teacher of a practice. `collection` is
 * where that collection is, its name or a path through groups: "teachers", "studio.teachers".
 */
export interface ReferenceField {
  readonly kind: "reference";
  readonly label: string;
  readonly collection: string;
}

/** Any number of records of a collection of the schema, by their ids: the practices a teacher leads. */
export interface ReferencesField {
  readonly kind: "references";
  readonly label: string;
  readonly collection: string;
}

/** Named fields shown and stored together, for example the first screen of a page. */
export interface GroupField<F extends Fields = Fields> {
  readonly kind: "group";
  readonly label: string;
  readonly fields: F;
}

/**
 * A list of records of the same shape, for example the items of a menu. Every record also has an
 * `id` of its own, which never changes (see withRecordIds), so a record has no field named `id`.
 */
export interface CollectionField<F extends RecordFields = RecordFields> {
  readonly kind: "collection";
  readonly label: string;
  readonly item: F;
  /** The field of a record that names it in the editor: a text field, or a link by its text. */
  readonly itemTitle?: keyof F & string;
}

export type Field =
  | TextField
  | RichTextField
  | NumberField
  | DateField
  | ImageField
  | FileField
  | LinkField
  | ToggleField
  | ChoiceField
  | ChoicesField
  | UrlField
  | TimeField
  | SlugField
  | ReferenceField
  | ReferencesField
  | GroupField
  | CollectionField;

export type FieldKind = Field["kind"];

/** Field names to fields; the order of the keys is the order of the form. */
export interface Fields {
  readonly [name: string]: Field;
}

/** The fields of a record of a collection: any fields but `id`, which is the record's own. */
export type RecordFields = Fields & { readonly id?: never };

type FieldOptions<F extends Field> = Omit<F, "kind">;

/** The root of a site's schema. Only checks the shape and keeps the literal types. */
export function defineSchema<F extends Fields>(fields: F): F {
  return fields;
}

export function text(options: FieldOptions<TextField>): TextField {
  return { kind: "text", ...options };
}

export function richText(options: FieldOptions<RichTextField>): RichTextField {
  return { kind: "richText", ...options };
}

export function number(options: FieldOptions<NumberField>): NumberField {
  return { kind: "number", ...options };
}

export function date(options: FieldOptions<DateField>): DateField {
  return { kind: "date", ...options };
}

export function image(options: FieldOptions<ImageField>): ImageField {
  return { kind: "image", ...options };
}

export function file(options: FieldOptions<FileField>): FileField {
  return { kind: "file", ...options };
}

export function link(options: FieldOptions<LinkField>): LinkField {
  return { kind: "link", ...options };
}

export function toggle(options: FieldOptions<ToggleField>): ToggleField {
  return { kind: "toggle", ...options };
}

/** `const` keeps the values of the options literal, so the content has their exact type. */
export function choice<const O extends readonly ChoiceOption[]>(
  options: FieldOptions<ChoiceField<O>>,
): ChoiceField<O> {
  return { kind: "choice", ...options };
}

export function choices<const O extends readonly ChoiceOption[]>(
  options: FieldOptions<ChoicesField<O>>,
): ChoicesField<O> {
  return { kind: "choices", ...options };
}

export function url(options: FieldOptions<UrlField>): UrlField {
  return { kind: "url", ...options };
}

export function time(options: FieldOptions<TimeField>): TimeField {
  return { kind: "time", ...options };
}

export function slug(options: FieldOptions<SlugField>): SlugField {
  return { kind: "slug", ...options };
}

export function reference(
  options: FieldOptions<ReferenceField>,
): ReferenceField {
  return { kind: "reference", ...options };
}

export function references(
  options: FieldOptions<ReferencesField>,
): ReferencesField {
  return { kind: "references", ...options };
}

export function group<F extends Fields>(
  options: FieldOptions<GroupField<F>>,
): GroupField<F> {
  return { kind: "group", ...options };
}

export function collection<F extends RecordFields>(
  options: FieldOptions<CollectionField<F>>,
): CollectionField<F> {
  return { kind: "collection", ...options };
}
