import type {
  ChoiceField,
  ChoiceOption,
  ChoicesField,
  CollectionField,
  FieldKind,
  RecordFields,
} from "./fields";
import type { Content, FieldValue } from "./content";
import { isContentObject } from "./json-values";
import { WEEKDAYS } from "./presets";

// How a record of a collection reads as words where it is named by one of its fields (its
// `itemTitle`): in the CMS's list of records and history, and in what a site tells search engines.
// The site and the CMS read it with this one code, so a record has the same name everywhere.

/** The kinds of fields `itemTitle` may name: a record is named by their words. */
export const TITLE_KINDS: ReadonlySet<FieldKind> = new Set<FieldKind>([
  "text",
  "link",
  "choice",
  "choices",
]);

/** How many days of the week in a row are written as their first and last: «Пн–Пт». */
const MIN_COMPRESSED_DAYS = 3;

const LIST_SEPARATOR = ", ";
const RANGE_SEPARATOR = "–";

const WEEKDAY_VALUES: readonly string[] = WEEKDAYS.map((day) => day.value);

/**
 * The words of the record's title field: a text, a link's text, or the labels of the options picked
 * (see choiceTitleOf). Empty when the collection names no title or the record has no words there.
 */
export function recordTitleOf<F extends RecordFields>(
  collection: CollectionField<F>,
  record: Content,
): string {
  const name = collection.itemTitle;
  if (name === undefined) return "";

  const fields: RecordFields = collection.item;
  const field = fields[name];
  const value = record[name] ?? null;
  const isChoice = field.kind === "choice" || field.kind === "choices";
  if (isChoice) return choiceTitleOf(field, value);
  return textTitleOf(value);
}

/**
 * The labels of the options a choice holds, as a title reads them. A `choice` gives its option's
 * label; `choices` the labels in the schema's order, joined by commas, with three or more days of
 * the week in a row written as the first and the last («Пн–Пт, Сб») when its options are days of
 * the week in their order (as `openingHoursField()` has them). A value the options no longer list
 * reads as itself, after the others; nothing picked reads as an empty text.
 */
export function choiceTitleOf(
  field: ChoiceField | ChoicesField,
  value: FieldValue,
): string {
  const picked = pickedValuesOf(value);
  const known = field.options.filter((option) => picked.includes(option.value));
  const knownValues = known.map((option) => option.value);
  const unknown = picked.filter((pick) => !knownValues.includes(pick));
  const knownWords = isWeek(field.options)
    ? dayRunsOf(known)
    : known.map((option) => option.label);
  return [...knownWords, ...unknown].join(LIST_SEPARATOR);
}

function textTitleOf(value: FieldValue): string {
  if (typeof value === "string") return value.trim();

  const linkText = isContentObject(value) ? value["text"] : undefined;
  return typeof linkText === "string" ? linkText.trim() : "";
}

function pickedValuesOf(value: FieldValue): readonly string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((pick): pick is string => typeof pick === "string");
}

/** Whether the options are days of the week, each a weekday of WEEKDAYS, in the week's order. */
function isWeek(options: readonly ChoiceOption[]): boolean {
  const places = options.map((option) => WEEKDAY_VALUES.indexOf(option.value));
  const isEveryDay = places.every((place) => place >= 0);
  const isInOrder = places.every(
    (place, index) => index === 0 || place > (places[index - 1] ?? place),
  );
  return options.length > 0 && isEveryDay && isInOrder;
}

/** The labels of the days picked, a run of consecutive days of the week as «Пн–Пт». */
function dayRunsOf(days: readonly ChoiceOption[]): string[] {
  const runs: ChoiceOption[][] = [];
  for (const day of days) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    const isNextDay =
      last !== undefined &&
      WEEKDAY_VALUES.indexOf(day.value) ===
        WEEKDAY_VALUES.indexOf(last.value) + 1;
    if (run !== undefined && isNextDay) run.push(day);
    else runs.push([day]);
  }
  return runs.flatMap(wordsOfRun);
}

function wordsOfRun(run: readonly ChoiceOption[]): string[] {
  const first = run[0];
  const last = run.at(-1);
  const isCompressed =
    run.length >= MIN_COMPRESSED_DAYS &&
    first !== undefined &&
    last !== undefined;
  if (!isCompressed) return run.map((day) => day.label);
  return [`${first.label}${RANGE_SEPARATOR}${last.label}`];
}
