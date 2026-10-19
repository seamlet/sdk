import type {
  ChoiceOption,
  CollectionField,
  Field,
  FieldKind,
  Fields,
  GroupField,
} from "./fields";

// A schema read back from JSON: the CMS takes a site's schema from the site itself, so it reads
// every field by its kind and keeps only what the schema language knows. Anything else, a kind it
// does not know, a label that is not a text, makes the whole schema unread.

type Read<T> = T | undefined;
type JsonRecord = Readonly<Record<string, unknown>>;

/** The schema the input describes, or undefined when it is not one. */
export function readFields(input: unknown): Fields | undefined {
  if (!isRecord(input)) return undefined;

  const entries = Object.entries(input).map(
    ([name, value]) => [name, readField(value)] as const,
  );
  const readEntries = entries.flatMap(([name, field]) =>
    field === undefined ? [] : [[name, field] as const],
  );
  const isEveryFieldRead = readEntries.length === entries.length;
  return isEveryFieldRead ? Object.fromEntries(readEntries) : undefined;
}

function readField(input: unknown): Read<Field> {
  if (!isRecord(input)) return undefined;
  const label = input["label"];
  if (typeof label !== "string") return undefined;

  const kind = input["kind"];
  return isFieldKind(kind) ? readFieldOfKind(kind, label, input) : undefined;
}

function readFieldOfKind(
  kind: FieldKind,
  label: string,
  input: JsonRecord,
): Read<Field> {
  switch (kind) {
    case "text":
      return {
        kind,
        label,
        ...optional("multiline", input["multiline"], isBoolean),
        ...optional("maxLength", input["maxLength"], isCount),
      };
    case "richText":
      return {
        kind,
        label,
        ...optional("inline", input["inline"], isBoolean),
        ...optional("maxLength", input["maxLength"], isCount),
      };
    case "number":
      return {
        kind,
        label,
        ...optional("min", input["min"], isNumber),
        ...optional("max", input["max"], isNumber),
      };
    case "date":
    case "image":
    case "link":
    case "toggle":
    case "url":
    case "time":
      return { kind, label };
    case "choice":
    case "choices":
      return readChoiceField(kind, label, input["options"]);
    case "reference":
    case "references":
      return readReferenceField(kind, label, input["collection"]);
    case "group":
      return readGroupField(label, input["fields"]);
    case "collection":
      return readCollectionField(label, input);
  }
}

function readChoiceField(
  kind: "choice" | "choices",
  label: string,
  input: unknown,
): Read<Field> {
  if (!Array.isArray(input)) return undefined;
  const options: unknown[] = input;
  if (!options.every(isChoiceOption)) return undefined;

  const read = options.map(({ value, label: optionLabel }) => ({
    value,
    label: optionLabel,
  }));
  return { kind, label, options: read };
}

function readReferenceField(
  kind: "reference" | "references",
  label: string,
  collection: unknown,
): Read<Field> {
  return typeof collection === "string"
    ? { kind, label, collection }
    : undefined;
}

function readGroupField(label: string, input: unknown): Read<GroupField> {
  const fields = readFields(input);
  return fields === undefined ? undefined : { kind: "group", label, fields };
}

function readCollectionField(
  label: string,
  input: JsonRecord,
): Read<CollectionField> {
  const item = readFields(input["item"]);
  if (item === undefined || "id" in item) return undefined;

  const itemTitle = input["itemTitle"];
  const isTitleKnown = typeof itemTitle === "string" && itemTitle in item;
  if (itemTitle !== undefined && !isTitleKnown) return undefined;
  return {
    kind: "collection",
    label,
    item,
    ...(isTitleKnown ? { itemTitle } : {}),
  };
}

/** The key with the value when it is there and of its kind; nothing when it is left out. */
function optional<K extends string, T>(
  key: K,
  value: unknown,
  isOfKind: (value: unknown) => value is T,
): Partial<Record<K, T>> {
  if (!isOfKind(value)) return {};
  return { [key]: value } as Partial<Record<K, T>>;
}

const FIELD_KINDS: ReadonlySet<string> = new Set<FieldKind>([
  "text",
  "richText",
  "number",
  "date",
  "image",
  "link",
  "toggle",
  "choice",
  "choices",
  "url",
  "time",
  "reference",
  "references",
  "group",
  "collection",
]);

function isFieldKind(value: unknown): value is FieldKind {
  return typeof value === "string" && FIELD_KINDS.has(value);
}

function isChoiceOption(value: unknown): value is ChoiceOption {
  return (
    isRecord(value) &&
    typeof value["value"] === "string" &&
    typeof value["label"] === "string"
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
