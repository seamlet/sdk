import {
  resolveFieldPath,
  type FieldPath,
  type Fields,
  type ImageField,
} from "../schema";

/** The image field a marker points at, or undefined when it points at anything else. */
export function imageFieldAt(
  schema: Fields,
  path: string | undefined,
): { readonly path: FieldPath; readonly field: ImageField } | undefined {
  const target =
    path === undefined ? undefined : resolveFieldPath(schema, path);
  const isImage = target?.kind === "field" && target.field.kind === "image";
  return isImage ? { path: target.path, field: target.field } : undefined;
}
