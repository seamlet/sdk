import type { Content, FieldValue } from "./content";
import type { Field, Fields } from "./fields";
import type { ContentIssue, FieldPath } from "./parse-content";
import { collectionAt, RECORD_ID_KEY } from "./record-ids";
import { isContentObject } from "./json-values";

// A reference names a record of another collection of the same content, so it is checked once the
// whole content is there: a record removed since leaves an issue at every reference to it.

/** Issues of the references in the content to records their collections do not have. */
export function missingRecordIssues(
  schema: Fields,
  content: Content,
): readonly ContentIssue[] {
  const idsOf = (collection: string) =>
    recordIdsAt(schema, content, collection);
  return issuesInFields(schema, content, [], idsOf);
}

type RecordIdsOf = (collection: string) => ReadonlySet<string>;

function issuesInFields(
  fields: Fields,
  content: Content,
  path: FieldPath,
  idsOf: RecordIdsOf,
): readonly ContentIssue[] {
  return Object.entries(fields).flatMap(([name, field]) =>
    issuesInField(field, content[name], [...path, name], idsOf),
  );
}

function issuesInField(
  field: Field,
  value: FieldValue | undefined,
  path: FieldPath,
  idsOf: RecordIdsOf,
): readonly ContentIssue[] {
  switch (field.kind) {
    case "reference":
      return missingIds(
        typeof value === "string" ? [value] : [],
        field,
        path,
        idsOf,
      );
    case "references":
      return missingIds(stringsOf(value), field, path, idsOf);
    case "group":
      return isContentObject(value)
        ? issuesInFields(field.fields, value, path, idsOf)
        : [];
    case "collection":
      return recordsOf(value).flatMap((record, index) =>
        issuesInFields(field.item, record, [...path, index], idsOf),
      );
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
      return [];
  }
}

function missingIds(
  ids: readonly string[],
  field: { readonly collection: string },
  path: FieldPath,
  idsOf: RecordIdsOf,
): readonly ContentIssue[] {
  const known = idsOf(field.collection);
  const missing = ids.filter((id) => !known.has(id));
  return missing.map((id) => ({ path, code: "missing-record", id }));
}

/** The ids of the records of the collection at the path, none when the schema has no such collection. */
function recordIdsAt(
  schema: Fields,
  content: Content,
  path: string,
): ReadonlySet<string> {
  const records = collectionAt(schema, content, path)?.records ?? [];
  const ids = records.map((record) => record[RECORD_ID_KEY]);
  return new Set(ids.filter((id) => typeof id === "string"));
}

function recordsOf(value: FieldValue | undefined): readonly Content[] {
  return Array.isArray(value) ? value.filter(isContentObject) : [];
}

function stringsOf(value: FieldValue | undefined): readonly string[] {
  const list: readonly unknown[] = Array.isArray(value) ? value : [];
  return list.filter((id) => typeof id === "string");
}
