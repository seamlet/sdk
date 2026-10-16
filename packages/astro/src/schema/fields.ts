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
 * A link: its text and where it leads (a page of the site, another site, a phone or an email).
 * The site decides how it looks; a button «Записаться» stays a button.
 */
export interface LinkField {
  readonly kind: "link";
  readonly label: string;
}

/** Named fields shown and stored together, for example the first screen of a page. */
export interface GroupField<F extends Fields = Fields> {
  readonly kind: "group";
  readonly label: string;
  readonly fields: F;
}

/** A list of records of the same shape, for example the items of a menu. */
export interface CollectionField<F extends Fields = Fields> {
  readonly kind: "collection";
  readonly label: string;
  readonly item: F;
  /** The field of a record that names it in the editor: a text field, or a link by its text. */
  readonly itemTitle?: keyof F & string;
}

export type Field =
  | TextField
  | NumberField
  | DateField
  | ImageField
  | LinkField
  | GroupField
  | CollectionField;

export type FieldKind = Field["kind"];

/** Field names to fields; the order of the keys is the order of the form. */
export interface Fields {
  readonly [name: string]: Field;
}

type FieldOptions<F extends Field> = Omit<F, "kind">;

/** The root of a site's schema. Only checks the shape and keeps the literal types. */
export function defineSchema<F extends Fields>(fields: F): F {
  return fields;
}

export function text(options: FieldOptions<TextField>): TextField {
  return { kind: "text", ...options };
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

export function link(options: FieldOptions<LinkField>): LinkField {
  return { kind: "link", ...options };
}

export function group<F extends Fields>(
  options: FieldOptions<GroupField<F>>,
): GroupField<F> {
  return { kind: "group", ...options };
}

export function collection<F extends Fields>(
  options: FieldOptions<CollectionField<F>>,
): CollectionField<F> {
  return { kind: "collection", ...options };
}
