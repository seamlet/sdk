import { formatFieldPath, type FieldPath } from "../schema";

/**
 * The path a site marked for a field: the path itself or, when the site did not mark it, the
 * closest path around it (the record of a price the page shows only as part of the record).
 */
export function closestMarkedPath(
  path: FieldPath,
  isMarked: (path: string) => boolean,
): string | undefined {
  for (let length = path.length; length > 0; length -= 1) {
    const candidate = formatFieldPath(path.slice(0, length));
    if (isMarked(candidate)) return candidate;
  }
  return undefined;
}
