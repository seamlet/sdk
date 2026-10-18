import type {
  ChoiceField,
  ChoiceOption,
  ChoicesField,
  CollectionField,
  DateField,
  Field,
  Fields,
  GroupField,
  ImageField,
  LinkField,
  NumberField,
  TextField,
  TimeField,
  ToggleField,
  UrlField,
} from "./fields";

export interface ImageValue {
  readonly src: string;
  readonly alt: string;
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
  : F extends NumberField
    ? number | null
    : F extends DateField
      ? string | null
      : F extends ImageField
        ? ImageValue | null
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
                    : F extends GroupField<infer Group>
                      ? ContentOf<Group>
                      : F extends CollectionField<infer Item>
                        ? readonly ContentOf<Item>[]
                        : never;

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
  | LinkValue
  | Content
  | readonly Content[];

export function defaultValue(field: Field): FieldValue {
  switch (field.kind) {
    case "text":
      return "";
    case "toggle":
      return false;
    case "choices":
      return [];
    case "number":
    case "date":
    case "image":
    case "link":
    case "choice":
    case "url":
    case "time":
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
