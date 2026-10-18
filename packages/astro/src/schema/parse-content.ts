import {
  defaultContent,
  defaultValue,
  type Content,
  type ContentOf,
  type FieldValue,
} from "./content";
import { linkTargetOf } from "./link-addresses";
import type {
  ChoiceField,
  ChoicesField,
  CollectionField,
  DateField,
  Field,
  Fields,
  ImageField,
  LinkField,
  NumberField,
  TextField,
  TimeField,
  ToggleField,
  UrlField,
} from "./fields";

/** Where a value lives in the content: field names and, inside a collection, record indexes. */
export type FieldPath = readonly (string | number)[];

export type ContentIssue =
  | { readonly path: FieldPath; readonly code: "invalid-type" }
  | { readonly path: FieldPath; readonly code: "invalid-date" }
  | { readonly path: FieldPath; readonly code: "invalid-time" }
  | {
      readonly path: FieldPath;
      readonly code: "too-long";
      readonly maxLength: number;
    }
  | {
      readonly path: FieldPath;
      readonly code: "below-min";
      readonly min: number;
    }
  | {
      readonly path: FieldPath;
      readonly code: "above-max";
      readonly max: number;
    }
  | { readonly path: FieldPath; readonly code: "missing-image-src" }
  | { readonly path: FieldPath; readonly code: "missing-link-href" }
  | { readonly path: FieldPath; readonly code: "unsupported-link-href" }
  | { readonly path: FieldPath; readonly code: "unsupported-url" }
  | {
      readonly path: FieldPath;
      readonly code: "unknown-choice";
      readonly value: string;
    };

export interface ParsedContent<C> {
  readonly content: C;
  readonly issues: readonly ContentIssue[];
}

interface ParsedValue<V extends FieldValue = FieldValue> {
  readonly value: V;
  readonly issues: readonly ContentIssue[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
/** `HH:MM` of a 24-hour day: 00:00 to 23:59. */
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const GRAPHEMES = new Intl.Segmenter("ru-RU", { granularity: "grapheme" });

export function formatFieldPath(path: FieldPath): string {
  return path.join(".");
}

/**
 * The length that `maxLength` limits: characters as people see them (grapheme clusters), so
 * "й" and "👍🏽" are one character each, whatever number of code units they take.
 */
export function countCharacters(text: string): number {
  return [...GRAPHEMES.segment(text)].length;
}

/**
 * Brings any input to the shape of the schema, so the result is always content of that schema:
 * - a field missing from the input (the schema grew after the content was saved) gets its default;
 * - a value of the wrong type or format gets the default too, and an issue;
 * - a value of the right type that breaks a rule of its field (too long, below the minimum) is
 *   kept, with an issue: nothing a person typed is lost;
 * - keys the schema does not know are dropped.
 * Content with issues is valid to show and edit, but not to save.
 */
export function parseContent<F extends Fields>(
  schema: F,
  input: unknown,
): ParsedContent<ContentOf<F>> {
  const parsed = parseFields(schema, input, []);
  // Every value is built from its field, so the content has exactly the shape the schema describes.
  return { content: parsed.value as ContentOf<F>, issues: parsed.issues };
}

function parseFields(
  fields: Fields,
  input: unknown,
  path: FieldPath,
): ParsedValue<Content> {
  if (!isRecord(input)) {
    return invalidType(defaultContent(fields), path);
  }

  const parsedFields = Object.entries(fields).map(([name, field]) => {
    const fieldInput = Object.hasOwn(input, name) ? input[name] : undefined;
    return [name, parseField(field, fieldInput, [...path, name])] as const;
  });
  const content = Object.fromEntries(
    parsedFields.map(([name, parsed]) => [name, parsed.value]),
  );
  const issues = parsedFields.flatMap(([, parsed]) => parsed.issues);
  return { value: content, issues };
}

function parseField(
  field: Field,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (input === undefined) {
    return valid(defaultValue(field));
  }

  switch (field.kind) {
    case "text":
      return parseText(field, input, path);
    case "number":
      return parseNumber(field, input, path);
    case "date":
      return parseDate(field, input, path);
    case "image":
      return parseImage(field, input, path);
    case "link":
      return parseLink(field, input, path);
    case "toggle":
      return parseToggle(field, input, path);
    case "choice":
      return parseChoice(field, input, path);
    case "choices":
      return parseChoices(field, input, path);
    case "url":
      return parseUrl(field, input, path);
    case "time":
      return parseTime(field, input, path);
    case "group":
      return parseFields(field.fields, input, path);
    case "collection":
      return parseCollection(field, input, path);
  }
}

function parseText(
  field: TextField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (typeof input !== "string") {
    return invalidType(defaultValue(field), path);
  }

  const isTooLong =
    field.maxLength !== undefined && countCharacters(input) > field.maxLength;
  if (isTooLong) {
    return {
      value: input,
      issues: [{ path, code: "too-long", maxLength: field.maxLength }],
    };
  }
  return valid(input);
}

function parseNumber(
  field: NumberField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (input === null) {
    return valid(null);
  }
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return invalidType(defaultValue(field), path);
  }

  if (field.min !== undefined && input < field.min) {
    return {
      value: input,
      issues: [{ path, code: "below-min", min: field.min }],
    };
  }
  if (field.max !== undefined && input > field.max) {
    return {
      value: input,
      issues: [{ path, code: "above-max", max: field.max }],
    };
  }
  return valid(input);
}

function parseDate(
  field: DateField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (input === null) {
    return valid(null);
  }
  if (typeof input !== "string") {
    return invalidType(defaultValue(field), path);
  }

  if (!isCalendarDate(input)) {
    return {
      value: defaultValue(field),
      issues: [{ path, code: "invalid-date" }],
    };
  }
  return valid(input);
}

function parseImage(
  field: ImageField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (input === null) {
    return valid(null);
  }
  const src = isRecord(input) ? input["src"] : undefined;
  const alt = isRecord(input) ? input["alt"] : undefined;
  if (typeof src !== "string" || typeof alt !== "string") {
    return invalidType(defaultValue(field), path);
  }

  const image = { src, alt };
  if (src.trim() === "") {
    return { value: image, issues: [{ path, code: "missing-image-src" }] };
  }
  return valid(image);
}

function parseLink(
  field: LinkField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (input === null) {
    return valid(null);
  }
  if (!isRecord(input)) {
    return invalidType(defaultValue(field), path);
  }
  const { text, href } = input;
  if (typeof text !== "string" || typeof href !== "string") {
    return invalidType(defaultValue(field), path);
  }

  const link = { text, href };
  if (href.trim() === "") {
    return { value: link, issues: [{ path, code: "missing-link-href" }] };
  }
  // Kept with an issue, like every value a person typed: it shows what to fix, and it never saves.
  if (linkTargetOf(href) === undefined) {
    return { value: link, issues: [{ path, code: "unsupported-link-href" }] };
  }
  return valid(link);
}

function parseToggle(
  field: ToggleField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (typeof input !== "boolean") {
    return invalidType(defaultValue(field), path);
  }
  return valid(input);
}

/** An option the schema no longer lists is kept with an issue: the person picks another one. */
function parseChoice(
  field: ChoiceField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (input === null) {
    return valid(null);
  }
  if (typeof input !== "string") {
    return invalidType(defaultValue(field), path);
  }

  const issues = unknownChoiceIssues(field, [input], path);
  return { value: input, issues };
}

function parseChoices(
  field: ChoicesField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  const isListOfStrings =
    Array.isArray(input) &&
    input.every((value: unknown) => typeof value === "string");
  if (!isListOfStrings) {
    return invalidType(defaultValue(field), path);
  }

  const picked: readonly string[] = [...new Set<string>(input)];
  const issues = unknownChoiceIssues(field, picked, path);
  return { value: picked, issues };
}

function unknownChoiceIssues(
  field: ChoiceField | ChoicesField,
  picked: readonly string[],
  path: FieldPath,
): readonly ContentIssue[] {
  const known = new Set(field.options.map((option) => option.value));
  const unknown = picked.filter((value) => !known.has(value));
  return unknown.map((value) => ({ path, code: "unknown-choice", value }));
}

function parseUrl(
  field: UrlField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (input === null) {
    return valid(null);
  }
  if (typeof input !== "string") {
    return invalidType(defaultValue(field), path);
  }

  const isWebAddress = linkTargetOf(input)?.kind === "web";
  if (!isWebAddress) {
    return { value: input, issues: [{ path, code: "unsupported-url" }] };
  }
  return valid(input);
}

function parseTime(
  field: TimeField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (input === null) {
    return valid(null);
  }
  if (typeof input !== "string") {
    return invalidType(defaultValue(field), path);
  }

  if (!TIME_PATTERN.test(input)) {
    return {
      value: defaultValue(field),
      issues: [{ path, code: "invalid-time" }],
    };
  }
  return valid(input);
}

function parseCollection(
  field: CollectionField,
  input: unknown,
  path: FieldPath,
): ParsedValue {
  if (!Array.isArray(input)) {
    return invalidType(defaultValue(field), path);
  }

  const records: readonly unknown[] = input;
  const parsedRecords = records.map((record, index) =>
    parseFields(field.item, record, [...path, index]),
  );
  return {
    value: parsedRecords.map((parsed) => parsed.value),
    issues: parsedRecords.flatMap((parsed) => parsed.issues),
  };
}

/** `YYYY-MM-DD` that names a real day: 2026-02-30 is not one. */
function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valid<V extends FieldValue>(value: V): ParsedValue<V> {
  return { value, issues: [] };
}

function invalidType<V extends FieldValue>(
  fallback: V,
  path: FieldPath,
): ParsedValue<V> {
  return { value: fallback, issues: [{ path, code: "invalid-type" }] };
}
