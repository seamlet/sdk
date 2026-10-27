import type { Content, FieldValue } from "./content";
import type { CollectionField, Field, Fields, RecordFields } from "./fields";
import { isContentObject } from "./json-values";
import type { ContentIssue, FieldPath } from "./parse-content";
import { RECORD_ID_KEY } from "./record-ids";

// The slug of a record is the address of its page, and an address leads to one page: a slug another
// record of the collection already has, as its slug or as its id (the address of a record without a
// slug), is checked once the whole collection is there.

/** The name of the slug of a record of the collection, if its records have one. */
export function slugFieldOf(item: RecordFields): string | undefined {
  const named = Object.entries(item).find(([, field]) => field.kind === "slug");
  return named?.[0];
}

/** Issues of the slugs in the content that lead where another record of their collection is. */
export function takenSlugIssues(
  schema: Fields,
  content: Content,
): readonly ContentIssue[] {
  return issuesInFields(schema, content, []);
}

function issuesInFields(
  fields: Fields,
  content: Content,
  path: FieldPath,
): readonly ContentIssue[] {
  return Object.entries(fields).flatMap(([name, field]) =>
    issuesInField(field, content[name], [...path, name]),
  );
}

function issuesInField(
  field: Field,
  value: FieldValue | undefined,
  path: FieldPath,
): readonly ContentIssue[] {
  switch (field.kind) {
    case "group":
      return isContentObject(value)
        ? issuesInFields(field.fields, value, path)
        : [];
    case "collection":
      return issuesInCollection(field, recordsOf(value), path);
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
    case "words":
    case "url":
    case "time":
    case "slug":
    case "reference":
    case "references":
      return [];
  }
}

function issuesInCollection(
  collection: CollectionField,
  records: readonly Content[],
  path: FieldPath,
): readonly ContentIssue[] {
  const ownIssues = takenSlugsOf(collection, records, path);
  const innerIssues = records.flatMap((record, index) =>
    issuesInFields(collection.item, record, [...path, index]),
  );
  return [...ownIssues, ...innerIssues];
}

/** The records whose slug an earlier record has as its slug, or another record has as its id. */
function takenSlugsOf(
  collection: CollectionField,
  records: readonly Content[],
  path: FieldPath,
): readonly ContentIssue[] {
  const slugName = slugFieldOf(collection.item);
  if (slugName === undefined) return [];

  const ids = records.map((record) => record[RECORD_ID_KEY]);
  const slugs = records.map((record) => record[slugName]);
  return slugs.flatMap((slug, index) => {
    if (typeof slug !== "string" || slug === "") return [];

    const isAnEarlierSlug = slugs.indexOf(slug) < index;
    const isAnotherId = ids.some(
      (id, idIndex) => id === slug && idIndex !== index,
    );
    const isTaken = isAnEarlierSlug || isAnotherId;
    return isTaken
      ? [{ path: [...path, index, slugName], code: "taken-slug" } as const]
      : [];
  });
}

function recordsOf(value: FieldValue | undefined): readonly Content[] {
  return Array.isArray(value) ? value.filter(isContentObject) : [];
}
