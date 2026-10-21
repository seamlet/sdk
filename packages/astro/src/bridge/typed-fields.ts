import { resolveFieldPath, type Fields } from "../schema";

/** How a text field is typed in place: as plain text or as formatted text. */
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
      return "plain";
    case "richText":
      return "rich";
    case "number":
    case "date":
    case "time":
    case "slug":
    case "image":
    case "link":
    case "url":
    case "toggle":
    case "choice":
    case "choices":
    case "reference":
    case "references":
    case "group":
    case "collection":
      return undefined;
  }
}
