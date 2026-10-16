import type { ImageValue, LinkValue } from "./content";
import { formatFieldPath, type FieldPath } from "./parse-content";

// How a site shows the CMS where a field is on its page: one attribute with the path of the
// field on the element that renders it. The CMS needs nothing else from the markup, so the
// visual editor works with any design.

export const FIELD_PATH_ATTRIBUTE = "data-cms-path";

export interface FieldMarker {
  readonly [FIELD_PATH_ATTRIBUTE]: string;
}

/**
 * Every path in content of type C, as a tuple: ["hero"], ["hero", "title"], ["menu", 2],
 * ["menu", 2, "price"]. Scalars, images and links are leaves: an image is one field, not two.
 */
export type ContentPath<C> = C extends readonly (infer Record)[]
  ? [number] | [number, ...ContentPath<Record>]
  : C extends string | number | null | ImageValue | LinkValue
    ? never
    : {
        [Name in keyof C & string]: [Name] | [Name, ...ContentPath<C[Name]>];
      }[keyof C & string];

/**
 * The marker of a site's content type. On its page a site spreads it on the element that shows
 * a field or a record of a collection: `<h1 {...edit("hero", "title")}>`,
 * `<li {...edit("menu", index)}>`. A path that is not in the content does not compile.
 */
export function editable<C>(): (...path: ContentPath<C>) => FieldMarker;
// The implementation takes any path: the overload above narrows it to the paths of C for callers,
// and TypeScript cannot relate the recursive ContentPath<C> of an unknown C to a plain array.
export function editable(): (...path: FieldPath) => FieldMarker {
  return (...path) => ({ [FIELD_PATH_ATTRIBUTE]: formatFieldPath(path) });
}
