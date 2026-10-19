import type { CollectionField, Field, Fields } from "./fields";
import type { FieldPath } from "./parse-content";

/** What a path written on a page points at: a field, or a whole record of a collection. */
export type FieldTarget =
  | { readonly kind: "field"; readonly path: FieldPath; readonly field: Field }
  | {
      readonly kind: "record";
      readonly path: FieldPath;
      readonly collection: CollectionField;
      /** The place of the record in its collection, the last segment of its path. */
      readonly index: number;
    };

const RECORD_INDEX_PATTERN = /^\d+$/u;

/**
 * Reads a path from a field marker (`menu.2.price`) by the schema: names inside fields and
 * groups, indexes inside collections. A path the schema does not have gives undefined.
 */
export function resolveFieldPath(
  schema: Fields,
  text: string,
): FieldTarget | undefined {
  return resolveInFields(schema, text.split("."), []);
}

function resolveInFields(
  fields: Fields,
  segments: readonly string[],
  parentPath: FieldPath,
): FieldTarget | undefined {
  const [name, ...rest] = segments;
  const field =
    name !== undefined && Object.hasOwn(fields, name)
      ? fields[name]
      : undefined;
  if (name === undefined || field === undefined) {
    return undefined;
  }

  const path = [...parentPath, name];
  if (rest.length === 0) {
    return { kind: "field", path, field };
  }
  return resolveInsideField(field, rest, path);
}

function resolveInsideField(
  field: Field,
  segments: readonly string[],
  path: FieldPath,
): FieldTarget | undefined {
  switch (field.kind) {
    case "group":
      return resolveInFields(field.fields, segments, path);
    case "collection":
      return resolveInCollection(field, segments, path);
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

function resolveInCollection(
  collection: CollectionField,
  segments: readonly string[],
  collectionPath: FieldPath,
): FieldTarget | undefined {
  const [indexText, ...rest] = segments;
  if (indexText === undefined || !RECORD_INDEX_PATTERN.test(indexText)) {
    return undefined;
  }

  const index = Number(indexText);
  const recordPath = [...collectionPath, index];
  if (rest.length === 0) {
    return { kind: "record", path: recordPath, collection, index };
  }
  return resolveInFields(collection.item, rest, recordPath);
}
