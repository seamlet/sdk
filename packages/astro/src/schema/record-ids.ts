import { defaultContent, type Content, type ContentOf } from "./content";
import type { CollectionField, Field, Fields, RecordFields } from "./fields";
import { FIELD_PATH_SEPARATOR } from "./field-paths";
import { isContentObject } from "./json-values";

// Every record of a collection has an id of its own: an index changes when records move, an id
// never does, so a reference to a record and a page of a record keep pointing at it. Checking
// content never makes an id up (parseContent gives the same content for the same input every
// time); whoever stores content gives the records that have none an id, once.

export const RECORD_ID_KEY = "id";

/** Letters, digits, `-` and `_`: an id goes into addresses and attributes as it is. */
const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;

export function isRecordId(value: unknown): value is string {
  return typeof value === "string" && RECORD_ID_PATTERN.test(value);
}

/** A new record of a collection: its fields empty, its id the given one. */
export function newRecord<F extends RecordFields>(
  collection: CollectionField<F>,
  id: string,
): Content {
  return { ...defaultContent(collection.item), [RECORD_ID_KEY]: id };
}

/**
 * The content with an id given to every record that has none, and a new one to a record whose id
 * another record of its collection already has (a copy). Records with ids of their own keep them.
 */
export function withRecordIds<F extends Fields>(
  schema: F,
  content: ContentOf<F>,
  newId: () => string,
): ContentOf<F> {
  // The content keeps its shape: only ids of records are added or replaced.
  return withIdsInFields(schema, content, newId) as ContentOf<F>;
}

export interface CollectionRecords {
  readonly collection: CollectionField;
  readonly records: readonly Content[];
}

/**
 * The collection a reference points at, `"teachers"` or `"studio.teachers"` through groups, with
 * its records in the content; undefined when the schema has no collection there.
 */
export function collectionAt(
  schema: Fields,
  content: Content,
  path: string,
): CollectionRecords | undefined {
  return collectionIn(schema, content, path.split(FIELD_PATH_SEPARATOR));
}

function collectionIn(
  fields: Fields,
  content: Content,
  names: readonly string[],
): CollectionRecords | undefined {
  const [name, ...rest] = names;
  const field =
    name !== undefined && Object.hasOwn(fields, name)
      ? fields[name]
      : undefined;
  if (name === undefined || field === undefined) return undefined;

  const value = content[name];
  const isLast = rest.length === 0;
  switch (field.kind) {
    case "collection": {
      const records = Array.isArray(value) ? value.filter(isContentObject) : [];
      return isLast ? { collection: field, records } : undefined;
    }
    case "group":
      return !isLast && isContentObject(value)
        ? collectionIn(field.fields, value, rest)
        : undefined;
    case "text":
    case "richText":
    case "number":
    case "date":
    case "image":
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

/** The collection at a path of the schema through groups (`"studio.teachers"`), if it has one there. */
export function collectionFieldAt(
  schema: Fields,
  path: string,
): CollectionField | undefined {
  const [name, ...rest] = path.split(FIELD_PATH_SEPARATOR);
  const field =
    name !== undefined && Object.hasOwn(schema, name)
      ? schema[name]
      : undefined;
  if (field === undefined) return undefined;

  const isLast = rest.length === 0;
  switch (field.kind) {
    case "collection":
      return isLast ? field : undefined;
    case "group":
      return isLast
        ? undefined
        : collectionFieldAt(field.fields, rest.join(FIELD_PATH_SEPARATOR));
    case "text":
    case "richText":
    case "number":
    case "date":
    case "image":
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

/** The record of the list with the id, if it is there. */
export function findRecord<R extends { readonly id?: string }>(
  records: readonly R[],
  id: string | null,
): R | undefined {
  if (id === null) return undefined;
  return records.find((record) => record.id === id);
}

function withIdsInFields(
  fields: Fields,
  content: Content,
  newId: () => string,
): Content {
  const entries = Object.entries(content).map(([name, value]) => {
    const field = Object.hasOwn(fields, name) ? fields[name] : undefined;
    return [name, field === undefined ? value : withIdsIn(field, value, newId)];
  });
  return Object.fromEntries(entries) as Content;
}

function withIdsIn(
  field: Field,
  value: Content[string],
  newId: () => string,
): Content[string] {
  switch (field.kind) {
    case "group":
      return isContentObject(value)
        ? withIdsInFields(field.fields, value, newId)
        : value;
    case "collection":
      return Array.isArray(value)
        ? withIdsInRecords(field, value.filter(isContentObject), newId)
        : value;
    case "text":
    case "richText":
    case "number":
    case "date":
    case "image":
    case "link":
    case "toggle":
    case "choice":
    case "choices":
    case "url":
    case "time":
    case "reference":
    case "references":
      return value;
  }
}

function withIdsInRecords(
  collection: CollectionField,
  records: readonly Content[],
  newId: () => string,
): readonly Content[] {
  const taken = new Set<string>();
  return records.map((record) => {
    const own = record[RECORD_ID_KEY];
    const isOwnFree = isRecordId(own) && !taken.has(own);
    const id = isOwnFree ? own : newId();
    taken.add(id);
    const fields = withIdsInFields(collection.item, record, newId);
    return { ...fields, [RECORD_ID_KEY]: id };
  });
}
