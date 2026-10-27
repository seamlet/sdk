import { resolveFieldPath, type Fields } from "../schema";

/**
 * How a field is typed in place: as plain text (a text, the words of a link, a number, a time) or as
 * formatted text.
 */
export type TypedKind = "plain" | "rich";

/** How the field a marker points at is typed in place, or undefined for a field not typed. */
export function typedKindAt(
  schema: Fields,
  path: string,
): TypedKind | undefined {
  const target = resolveFieldPath(schema, path);
  if (target?.kind !== "field") return undefined;

  switch (target.field.kind) {
    case "text":
    case "link":
    case "number":
    case "time":
      return "plain";
    case "richText":
      return "rich";
    case "date":
    case "slug":
    case "image":
    case "file":
    case "url":
    case "toggle":
    case "choice":
    case "choices":
    case "words":
    case "reference":
    case "references":
    case "group":
    case "collection":
      return undefined;
  }
}
