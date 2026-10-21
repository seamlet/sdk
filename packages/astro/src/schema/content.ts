import type { RichText } from "./rich-text";
import type {
  ChoiceField,
  ChoiceOption,
  ChoicesField,
  CollectionField,
  DateField,
  Field,
  Fields,
  FileField,
  GroupField,
  ImageField,
  LinkField,
  NumberField,
  RecordFields,
  ReferenceField,
  ReferencesField,
  RichTextField,
  SlugField,
  TextField,
  TimeField,
  ToggleField,
  UrlField,
} from "./fields";

/** The point of a photo that must stay in view when a site crops it: 0 to 1 from the left and the top. */
export interface ImageFocus {
  readonly x: number;
  readonly y: number;
}

export interface ImageValue {
  readonly src: string;
  readonly alt: string;
  /** Unset: the middle of the photo (see imagePosition). */
  readonly focus?: ImageFocus;
}

/** A document uploaded in the CMS: where it is and the name the site shows for it. */
export interface FileValue {
  /** `/media/<site>/<file>.pdf`, or an address of the site's own files. */
  readonly src: string;
  /** «Прайс-лист», «Меню банкета»: the words of the link to it. */
  readonly name: string;
}

export interface LinkValue {
  readonly text: string;
  /** A path of the site (`/menu`), a web address, `tel:` or `mailto:`; see linkTargetOf. */
  readonly href: string;
}

/**
 * The value of each field. A text can be empty (""), the other scalar fields can be unset (null):
 * content is filled in by people, so a site must be ready for a missing price or date.
 */
export type ValueOf<F extends Field> = F extends TextField
  ? string
  : F extends RichTextField
    ? RichText
    : F extends NumberField
      ? number | null
      : F extends DateField
        ? string | null
        : F extends ImageField
          ? ImageValue | null
          : F extends FileField
            ? FileValue | null
            : F extends LinkField
              ? LinkValue | null
              : F extends ToggleField
                ? boolean
                : F extends ChoiceField<infer Options>
                  ? OptionValue<Options> | null
                  : F extends ChoicesField<infer Options>
                    ? readonly OptionValue<Options>[]
                    : F extends UrlField
                      ? string | null
                      : F extends TimeField
                        ? string | null
                        : F extends SlugField
                          ? string
                          : F extends ReferenceField
                            ? string | null
                            : F extends ReferencesField
                              ? readonly string[]
                              : F extends GroupField<infer Group>
                                ? ContentOf<Group>
                                : F extends CollectionField<infer Item>
                                  ? readonly RecordOf<Item>[]
                                  : never;

/**
 * A record of a collection: its fields and its id. The id is missing only in content no editor has
 * saved yet, such as a site's initial content (see withRecordIds).
 */
export type RecordOf<F extends RecordFields> = ContentOf<F> & {
  readonly id?: string;
};

/** The values a list of options stores: `"soft" | "active"` for options with those values. */
export type OptionValue<O extends readonly ChoiceOption[]> = O[number]["value"];

/** The content a schema describes: `ContentOf<typeof schema>` is the type a site renders. */
export type ContentOf<F extends Fields> = {
  readonly [Name in keyof F]: ValueOf<F[Name]>;
};

/** Content of any schema, for code that works with every site, such as the editor and the store. */
export interface Content {
  readonly [name: string]: FieldValue;
}

export type FieldValue =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | ImageValue
  | FileValue
  | LinkValue
  | RichText
  | Content
  | readonly Content[];

export function defaultValue(field: Field): FieldValue {
  switch (field.kind) {
    case "text":
    case "slug":
      return "";
    case "toggle":
      return false;
    case "choices":
    case "references":
    case "richText":
      return [];
    case "number":
    case "date":
    case "image":
    case "file":
    case "link":
    case "choice":
    case "url":
    case "time":
    case "reference":
      return null;
    case "group":
      return defaultContent(field.fields);
    case "collection":
      return [];
  }
}

export function defaultContent(fields: Fields): Content {
  return Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, defaultValue(field)]),
  );
}
