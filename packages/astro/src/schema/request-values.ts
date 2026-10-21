import { countCharacters } from "./parse-content";
import {
  maxLengthOf,
  type RequestField,
  type RequestForm,
} from "./request-forms";

// What a visitor sends with a form: the words of its fields by their names, and the request's own
// keys beside them. A form posted without a script and one sent by the site's script send the same
// flat entries, so one reader checks both, in the browser and in the CMS.

/** The id of the form the request is sent with. */
export const REQUEST_FORM_KEY = "seamlet-form";
/** The address of the page the request is sent from: `/catalog/banya-6x4`. */
export const REQUEST_PAGE_KEY = "seamlet-page";
/** The visitor's consent to the processing of what they send, given with the form's checkbox. */
export const REQUEST_CONSENT_KEY = "seamlet-consent";
/**
 * A field a person never sees and a program filling every field fills: a request that has words in
 * it is not a person's.
 */
export const REQUEST_TRAP_KEY = "seamlet-website";

/** What a checkbox sends when it is checked, posted by a form or by the site's script. */
const CHECKED_VALUES: ReadonlySet<string> = new Set(["on", "true"]);
const MAX_PAGE_LENGTH = 300;
/** A page's address on the site: a path, without the origin. */
const PAGE_PATH = /^\/[^\s]*$/u;
/** What people type between the digits of a phone number. */
const PHONE_SEPARATORS = /[\s().-]/gu;
/** A phone number: digits, a plus before them; from a city's short number to an international one. */
const PHONE_DIGITS = /^\+?\d{5,15}$/u;
/** An address with a name, `@` and a domain with a dot: whether mail reaches it, only mail tells. */
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MAX_EMAIL_LENGTH = 254;
const LINE_BREAKS = /\r\n?/gu;
const ANY_LINE_BREAK = /[\r\n]+/gu;

/** The words of a request as they come: the names of the form's fields and its own keys. */
export type RequestEntries = Readonly<Record<string, string>>;

/** A field the visitor filled in, as the business reads it. */
export interface RequestValue {
  /** The field's name in the form: `phone`. */
  readonly field: string;
  /** The field's label: «Телефон». */
  readonly label: string;
  readonly value: string;
}

export type RequestIssueCode =
  | "required"
  | "too-long"
  | "invalid-phone"
  | "invalid-email"
  | "unknown-option";

/** A field whose words the form cannot take, and why. */
export interface RequestIssue {
  readonly field: string;
  readonly code: RequestIssueCode;
}

export type RequestReading =
  | {
      readonly status: "read";
      /** The fields the visitor filled in, in the form's order. */
      readonly values: readonly RequestValue[];
    }
  | { readonly status: "invalid"; readonly issues: readonly RequestIssue[] };

/** What a visitor reads under a field whose words the form cannot take. */
export const REQUEST_ISSUE_TEXTS: Readonly<Record<RequestIssueCode, string>> = {
  required: "Заполните это поле",
  "too-long": "Здесь слишком длинный текст",
  "invalid-phone": "Проверьте номер телефона",
  "invalid-email": "Проверьте адрес почты",
  "unknown-option": "Выберите один из вариантов",
};

/** What a visitor reads when the consent's checkbox is left empty. */
export const CONSENT_REQUIRED_TEXT =
  "Отметьте согласие на обработку персональных данных";

/** The fields of the request as the form takes them, or every field it cannot take. */
export function readRequestValues(
  form: RequestForm,
  entries: RequestEntries,
): RequestReading {
  const readings = Object.entries(form.fields).map(([name, field]) =>
    readValue(name, field, entries[name] ?? ""),
  );
  const issues = readings.filter(isIssue);
  if (issues.length > 0) return { status: "invalid", issues };

  const values = readings.filter(isFilledValue);
  return { status: "read", values };
}

/** Whether the visitor checked the consent's checkbox. */
export function isConsentGiven(entries: RequestEntries): boolean {
  return CHECKED_VALUES.has(entries[REQUEST_CONSENT_KEY] ?? "");
}

/** Whether the field a person never sees was filled in: a program sent the request. */
export function isTrapFilled(entries: RequestEntries): boolean {
  return (entries[REQUEST_TRAP_KEY] ?? "").trim() !== "";
}

/** The page the request was sent from, or the home page when the request names no page. */
export function requestPageOf(entries: RequestEntries): string {
  const page = entries[REQUEST_PAGE_KEY] ?? "";
  const isPage = page.length <= MAX_PAGE_LENGTH && PAGE_PATH.test(page);
  return isPage ? page : "/";
}

/** The number as typed, when it is one: `+7 (912) 345-67-89`. */
export function isPhoneNumber(typed: string): boolean {
  return PHONE_DIGITS.test(typed.replaceAll(PHONE_SEPARATORS, ""));
}

export function isEmailAddress(typed: string): boolean {
  return typed.length <= MAX_EMAIL_LENGTH && EMAIL_ADDRESS.test(typed);
}

function readValue(
  name: string,
  field: RequestField,
  typed: string,
): RequestValue | RequestIssue {
  const words = wordsOf(field, typed);
  if (words === "") {
    return field.required === true
      ? { field: name, code: "required" }
      : { field: name, label: field.label, value: "" };
  }

  const code = issueOf(field, words);
  return code === undefined
    ? { field: name, label: field.label, value: words }
    : { field: name, code };
}

/** The words without spaces at their edges; a line keeps no line breaks, a long text one kind. */
function wordsOf(field: RequestField, typed: string): string {
  const trimmed = typed.trim();
  return field.kind === "longText"
    ? trimmed.replaceAll(LINE_BREAKS, "\n")
    : trimmed.replaceAll(ANY_LINE_BREAK, " ");
}

function issueOf(
  field: RequestField,
  words: string,
): RequestIssueCode | undefined {
  switch (field.kind) {
    case "text":
    case "longText":
      return countCharacters(words) > maxLengthOf(field)
        ? "too-long"
        : undefined;
    case "phone":
      return isPhoneNumber(words) ? undefined : "invalid-phone";
    case "email":
      return isEmailAddress(words) ? undefined : "invalid-email";
    case "choice":
      return field.options.includes(words) ? undefined : "unknown-option";
  }
}

function isIssue(
  reading: RequestValue | RequestIssue,
): reading is RequestIssue {
  return "code" in reading;
}

function isFilledValue(
  reading: RequestValue | RequestIssue,
): reading is RequestValue {
  return "value" in reading && reading.value !== "";
}
