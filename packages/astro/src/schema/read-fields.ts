import type {
  ChoiceOption,
  CollectionField,
  Field,
  FieldKind,
  Fields,
  GroupField,
  ReferenceField,
  ReferencesField,
} from "./fields";
import { FIELD_PATH_SEPARATOR, isRecordIndex } from "./field-paths";
import { isJsonObject, type JsonObject } from "./json-values";
import { collectionFieldAt, RECORD_ID_KEY } from "./record-ids";

// A schema read back from JSON: the CMS takes a site's schema from the site itself, so it reads
// every field by its kind and keeps only what the schema language knows. Anything that cannot
// work, a kind it does not know, a label that is not a text, an option of the wrong kind, a
// reference to a collection the schema does not have, makes the whole schema unread, with the
// first problem found.

/** Why a schema cannot be read. */
export type SchemaProblemReason =
  /** Not an object of fields, or a field that is not an object. */
  | "not-fields"
  /** A name that is empty, holds the separator of paths (`.`) or is a number, which a path reads as a record. */
  | "invalid-name"
  | "invalid-label"
  | "unknown-kind"
  /** An option of the field (`maxLength`, `inline`…) is there but not of its kind. */
  | "invalid-option"
  | "invalid-choice-options"
  /** A record has a field named `id`, which is the record's own. */
  | "record-id-field"
  /** `itemTitle` names no text or link field of the record. */
  | "invalid-item-title"
  /** A reference names a collection the schema does not have. */
  | "unknown-collection"
  /** A slug that is not the one slug of a record of a collection: only a record's page has one. */
  | "misplaced-slug";

export interface SchemaProblem {
  /** The names of the fields down to the field with the problem; empty for the schema itself. */
  readonly path: readonly string[];
  readonly reason: SchemaProblemReason;
}

export type FieldsReading =
  | { readonly status: "read"; readonly fields: Fields }
  | { readonly status: "invalid"; readonly problem: SchemaProblem };

type Reading<T> =
  | { readonly isRead: true; readonly value: T }
  | { readonly isRead: false; readonly problem: SchemaProblem };

type FieldPathNames = readonly string[];

/** A record of a collection may be named by the words of one of these fields. */
const TITLE_KINDS: ReadonlySet<FieldKind> = new Set<FieldKind>([
  "text",
  "link",
]);

/** The schema the input describes, or undefined when it is not one. */
export function readFields(input: unknown): Fields | undefined {
  const reading = checkFields(input);
  return reading.status === "read" ? reading.fields : undefined;
}

/** The schema the input describes, or the first problem that keeps it from being one. */
export function checkFields(input: unknown): FieldsReading {
  const reading = readFieldsAt(input, []);
  if (!reading.isRead) return { status: "invalid", problem: reading.problem };

  const problem =
    firstUnknownCollection(reading.value, reading.value, []) ??
    firstMisplacedSlug(reading.value, []);
  return problem === undefined
    ? { status: "read", fields: reading.value }
    : { status: "invalid", problem };
}

function readFieldsAt(input: unknown, path: FieldPathNames): Reading<Fields> {
  if (!isJsonObject(input)) return refused(path, "not-fields");

  const fields: Record<string, Field> = {};
  for (const [name, value] of Object.entries(input)) {
    const fieldPath = [...path, name];
    if (!isFieldName(name)) return refused(fieldPath, "invalid-name");

    const field = readField(value, fieldPath);
    if (!field.isRead) return field;
    fields[name] = field.value;
  }
  return read(fields);
}

function readField(input: unknown, path: FieldPathNames): Reading<Field> {
  if (!isJsonObject(input)) return refused(path, "not-fields");
  const { kind, label } = input;
  if (typeof label !== "string") return refused(path, "invalid-label");
  if (!isFieldKind(kind)) return refused(path, "unknown-kind");

  return readFieldOfKind({ kind, label, input, path });
}

interface FieldInput<K extends FieldKind = FieldKind> {
  readonly kind: K;
  readonly label: string;
  readonly input: JsonObject;
  readonly path: FieldPathNames;
}

function readFieldOfKind(field: FieldInput): Reading<Field> {
  const { kind, label, input, path } = field;
  switch (kind) {
    case "text":
      return withOptions({ kind, label }, path, [
        optional("multiline", input, isBoolean),
        optional("maxLength", input, isCount),
      ]);
    case "richText":
      return withOptions({ kind, label }, path, [
        optional("inline", input, isBoolean),
        optional("maxLength", input, isCount),
      ]);
    case "number":
      return withOptions({ kind, label }, path, [
        optional("min", input, isNumber),
        optional("max", input, isNumber),
      ]);
    case "date":
    case "image":
    case "file":
    case "link":
    case "toggle":
    case "url":
    case "time":
    case "slug":
      return read({ kind, label });
    case "choice":
    case "choices":
      return readChoiceField({ kind, label, input, path });
    case "reference":
    case "references":
      return readReferenceField({ kind, label, input, path });
    case "group":
      return readGroupField({ kind, label, input, path });
    case "collection":
      return readCollectionField({ kind, label, input, path });
  }
}

function readChoiceField(
  field: FieldInput<"choice" | "choices">,
): Reading<Field> {
  const { kind, label, input, path } = field;
  const options: unknown = input["options"];
  const isOptionList = Array.isArray(options) && options.every(isChoiceOption);
  if (!isOptionList) return refused(path, "invalid-choice-options");

  const knownOptions = options.map(({ value, label: optionLabel }) => ({
    value,
    label: optionLabel,
  }));
  return read({ kind, label, options: knownOptions });
}

function readReferenceField(
  field: FieldInput<"reference" | "references">,
): Reading<Field> {
  const { kind, label, input, path } = field;
  const collection = input["collection"];
  if (typeof collection !== "string") {
    return refused(path, "unknown-collection");
  }
  return read({ kind, label, collection });
}

function readGroupField(field: FieldInput<"group">): Reading<GroupField> {
  const { kind, label, input, path } = field;
  const fields = readFieldsAt(input["fields"], path);
  return fields.isRead ? read({ kind, label, fields: fields.value }) : fields;
}

function readCollectionField(
  field: FieldInput<"collection">,
): Reading<CollectionField> {
  const { kind, label, input, path } = field;
  const item = readFieldsAt(input["item"], path);
  if (!item.isRead) return item;
  if (RECORD_ID_KEY in item.value) {
    return refused([...path, RECORD_ID_KEY], "record-id-field");
  }

  const itemTitle = input["itemTitle"];
  if (itemTitle === undefined) return read({ kind, label, item: item.value });

  const titleField =
    typeof itemTitle === "string" && Object.hasOwn(item.value, itemTitle)
      ? item.value[itemTitle]
      : undefined;
  const canTitleRecord =
    titleField !== undefined && TITLE_KINDS.has(titleField.kind);
  if (typeof itemTitle !== "string" || !canTitleRecord) {
    return refused(path, "invalid-item-title");
  }
  return read({ kind, label, item: item.value, itemTitle });
}

/** The first reference, anywhere in the fields, to a collection the schema does not have. */
function firstUnknownCollection(
  schema: Fields,
  fields: Fields,
  path: FieldPathNames,
): SchemaProblem | undefined {
  for (const [name, field] of Object.entries(fields)) {
    const problem = unknownCollectionIn(schema, field, [...path, name]);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

function unknownCollectionIn(
  schema: Fields,
  field: Field,
  path: FieldPathNames,
): SchemaProblem | undefined {
  switch (field.kind) {
    case "reference":
    case "references":
      return referencesCollection(schema, field)
        ? undefined
        : { path, reason: "unknown-collection" };
    case "group":
      return firstUnknownCollection(schema, field.fields, path);
    case "collection":
      return firstUnknownCollection(schema, field.item, path);
    case "text":
    case "richText":
    case "number":
    case "date":
    case "image":
    case "file":
    case "link":
    case "toggle":
    case "choice":
    case "choices":
    case "url":
    case "time":
    case "slug":
      return undefined;
  }
}

/** The first slug outside a record of a collection, or a second slug of a record. */
function firstMisplacedSlug(
  fields: Fields,
  path: FieldPathNames,
): SchemaProblem | undefined {
  for (const [name, field] of Object.entries(fields)) {
    const problem = misplacedSlugIn(field, [...path, name]);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

function misplacedSlugIn(
  field: Field,
  path: FieldPathNames,
): SchemaProblem | undefined {
  switch (field.kind) {
    case "slug":
      return { path, reason: "misplaced-slug" };
    case "group":
      return firstMisplacedSlug(field.fields, path);
    case "collection":
      return misplacedSlugInRecord(field.item, path);
    case "text":
    case "richText":
    case "number":
    case "date":
    case "image":
    case "file":
    case "link":
    case "toggle":
    case "choice":
    case "choices":
    case "url":
    case "time":
    case "reference":
    case "references":
      return undefined;
  }
}

/** A record has one slug of its own; the groups and collections inside it have none. */
function misplacedSlugInRecord(
  item: Fields,
  path: FieldPathNames,
): SchemaProblem | undefined {
  const fields = Object.entries(item);
  const slugNames = fields
    .filter(([, field]) => field.kind === "slug")
    .map(([name]) => name);
  const [, secondSlug] = slugNames;
  if (secondSlug !== undefined) {
    return { path: [...path, secondSlug], reason: "misplaced-slug" };
  }

  const otherFields = fields.filter(([, field]) => field.kind !== "slug");
  return firstMisplacedSlug(Object.fromEntries(otherFields), path);
}

function referencesCollection(
  schema: Fields,
  field: ReferenceField | ReferencesField,
): boolean {
  return collectionFieldAt(schema, field.collection) !== undefined;
}

/** The field with its options, or a problem when one of them is there but not of its kind. */
function withOptions<F extends Field>(
  field: F,
  path: FieldPathNames,
  options: readonly (Partial<F> | undefined)[],
): Reading<F> {
  const isEveryOptionRead = options.every((option) => option !== undefined);
  if (!isEveryOptionRead) return refused(path, "invalid-option");
  return read(Object.assign({}, field, ...options));
}

/**
 * The option with its value when it is there and of its kind; nothing when it is left out;
 * undefined when it is there but not of its kind.
 */
function optional<K extends string, T>(
  key: K,
  input: JsonObject,
  isOfKind: (value: unknown) => value is T,
): Partial<Record<K, T>> | undefined {
  const value = input[key];
  if (value === undefined) return {};
  if (!isOfKind(value)) return undefined;
  return { [key]: value } as Partial<Record<K, T>>;
}

const FIELD_KINDS: Readonly<Record<FieldKind, true>> = {
  text: true,
  richText: true,
  number: true,
  date: true,
  image: true,
  file: true,
  link: true,
  toggle: true,
  choice: true,
  choices: true,
  url: true,
  time: true,
  slug: true,
  reference: true,
  references: true,
  group: true,
  collection: true,
};

function isFieldKind(value: unknown): value is FieldKind {
  return typeof value === "string" && Object.hasOwn(FIELD_KINDS, value);
}

function isFieldName(name: string): boolean {
  return (
    name !== "" && !name.includes(FIELD_PATH_SEPARATOR) && !isRecordIndex(name)
  );
}

function isChoiceOption(value: unknown): value is ChoiceOption {
  return (
    isJsonObject(value) &&
    typeof value["value"] === "string" &&
    typeof value["label"] === "string"
  );
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value >= 0;
}

function read<T>(value: T): Reading<T> {
  return { isRead: true, value };
}

function refused<T>(
  path: FieldPathNames,
  reason: SchemaProblemReason,
): Reading<T> {
  return { isRead: false, problem: { path, reason } };
}
