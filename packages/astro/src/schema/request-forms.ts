import { isJsonObject, isText } from "./json-values";

// The forms of a site's requests: «Обратный звонок», «Рассчитать стоимость», what a visitor sends the
// business from its site. A site declares them with these builders and hands them to the CMS in its
// description; the CMS keeps every request and passes it on to the business. A form is plain data,
// as the schema is, so the visitor's browser and the CMS check a request with the same code.

/** A line of words: a name, a city, the model of a car. */
export interface RequestTextField {
  readonly kind: "text";
  readonly label: string;
  readonly required?: boolean;
  /** In characters as people see them; `DEFAULT_TEXT_LENGTH` when left out. */
  readonly maxLength?: number;
}

/** Words of several lines: a comment, a question, what is to be built. */
export interface RequestLongTextField {
  readonly kind: "longText";
  readonly label: string;
  readonly required?: boolean;
  /** In characters as people see them; `DEFAULT_LONG_TEXT_LENGTH` when left out. */
  readonly maxLength?: number;
}

/** A phone number to call back. */
export interface RequestPhoneField {
  readonly kind: "phone";
  readonly label: string;
  readonly required?: boolean;
}

/** An email address to write back to. */
export interface RequestEmailField {
  readonly kind: "email";
  readonly label: string;
  readonly required?: boolean;
}

/** One of the options the form lists: a service, a size, a time to call. */
export interface RequestChoiceField {
  readonly kind: "choice";
  readonly label: string;
  readonly required?: boolean;
  /** The options as the visitor reads them; the request keeps the one picked, as it reads. */
  readonly options: readonly string[];
}

export type RequestField =
  | RequestTextField
  | RequestLongTextField
  | RequestPhoneField
  | RequestEmailField
  | RequestChoiceField;

export type RequestFieldKind = RequestField["kind"];

/** The fields of a form by their names, in the order the form shows them. */
export type RequestFields = Readonly<Record<string, RequestField>>;

export interface RequestForm<F extends RequestFields = RequestFields> {
  /** How the site and the CMS tell the form from the site's other forms: `callback`. */
  readonly id: string;
  /** How the CMS names the form's requests to the business: «Обратный звонок». */
  readonly title: string;
  readonly fields: F;
}

/** A line of words a visitor types without a limit of the site's own. */
export const DEFAULT_TEXT_LENGTH = 200;
/** A comment a visitor types without a limit of the site's own. */
export const DEFAULT_LONG_TEXT_LENGTH = 2000;
/** No field of a request holds more: a request is a message, not a document. */
export const MAX_REQUEST_FIELD_LENGTH = 5000;
/** More options than a visitor reads through. */
const MAX_OPTIONS = 50;
const MAX_FORM_ID_LENGTH = 40;

/** `callback`, `house-estimate`: lower-case Latin letters, digits and hyphens. */
const FORM_ID = /^[a-z][a-z0-9-]*$/u;
/**
 * `name`, `phone`, `preferredTime`: a name of a JavaScript property, so a request's own keys
 * (`seamlet-form`) never take a field's name.
 */
const FIELD_NAME = /^[a-z][a-zA-Z0-9]*$/u;

const REQUEST_FIELD_KINDS: readonly RequestFieldKind[] = [
  "text",
  "longText",
  "phone",
  "email",
  "choice",
];

/** Declares a form of the site's requests: `requestForm({ id, title, fields })`. */
export function requestForm<const F extends RequestFields>(
  form: RequestForm<F>,
): RequestForm<F> {
  return form;
}

export function requestText(
  options: Omit<RequestTextField, "kind">,
): RequestTextField {
  return { kind: "text", ...options };
}

export function requestLongText(
  options: Omit<RequestLongTextField, "kind">,
): RequestLongTextField {
  return { kind: "longText", ...options };
}

export function requestPhone(
  options: Omit<RequestPhoneField, "kind">,
): RequestPhoneField {
  return { kind: "phone", ...options };
}

export function requestEmail(
  options: Omit<RequestEmailField, "kind">,
): RequestEmailField {
  return { kind: "email", ...options };
}

export function requestChoice(
  options: Omit<RequestChoiceField, "kind">,
): RequestChoiceField {
  return { kind: "choice", ...options };
}

/** Why a form of a site's description cannot be read. */
export type RequestFormProblemReason =
  | "not-a-form"
  /** Not lower-case Latin letters, digits and hyphens, starting with a letter. */
  | "invalid-id"
  | "invalid-title"
  | "no-fields"
  /** A field's name is not a name of a JavaScript property such as `preferredTime`. */
  | "invalid-field-name"
  /** A field is not one of the kinds above, or its label, limit or options are not sound. */
  | "invalid-field";

export type RequestFormReading =
  | { readonly status: "read"; readonly form: RequestForm }
  | { readonly status: "invalid"; readonly reason: RequestFormProblemReason };

/** The form the input describes, read back from JSON, or why it is not one. */
export function readRequestForm(input: unknown): RequestFormReading {
  if (!isJsonObject(input)) return invalidForm("not-a-form");
  const { id, title, fields } = input;
  if (!isFormId(id)) return invalidForm("invalid-id");
  if (!isText(title)) return invalidForm("invalid-title");
  if (!isJsonObject(fields)) return invalidForm("no-fields");

  const entries = Object.entries(fields);
  if (entries.length === 0) return invalidForm("no-fields");
  const hasInvalidName = entries.some(([name]) => !FIELD_NAME.test(name));
  if (hasInvalidName) return invalidForm("invalid-field-name");

  const readFields = entries.map(
    ([name, field]) => [name, readRequestField(field)] as const,
  );
  const isEveryFieldRead = readFields.every(([, field]) => field !== undefined);
  if (!isEveryFieldRead) return invalidForm("invalid-field");

  const form = { id, title, fields: Object.fromEntries(readFields) };
  return { status: "read", form: form as RequestForm };
}

export function isFormId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_FORM_ID_LENGTH &&
    FORM_ID.test(value)
  );
}

/** The longest words the field takes, in characters as people see them. */
export function maxLengthOf(
  field: RequestTextField | RequestLongTextField,
): number {
  const fallback =
    field.kind === "text" ? DEFAULT_TEXT_LENGTH : DEFAULT_LONG_TEXT_LENGTH;
  return field.maxLength ?? fallback;
}

function readRequestField(input: unknown): RequestField | undefined {
  if (!isJsonObject(input)) return undefined;
  const { kind, label, required } = input;
  if (!isRequestFieldKind(kind) || !isText(label)) return undefined;
  if (required !== undefined && typeof required !== "boolean") {
    return undefined;
  }

  const common = { label, ...(required === undefined ? {} : { required }) };
  switch (kind) {
    case "text":
    case "longText":
      return withMaxLength(kind, common, input["maxLength"]);
    case "phone":
    case "email":
      return { kind, ...common };
    case "choice":
      return withOptions(common, input["options"]);
  }
}

function withMaxLength(
  kind: "text" | "longText",
  common: Omit<RequestTextField, "kind">,
  maxLength: unknown,
): RequestTextField | RequestLongTextField | undefined {
  if (maxLength === undefined) return { kind, ...common };

  const isSoundLength =
    Number.isInteger(maxLength) &&
    typeof maxLength === "number" &&
    maxLength > 0 &&
    maxLength <= MAX_REQUEST_FIELD_LENGTH;
  return isSoundLength ? { kind, ...common, maxLength } : undefined;
}

function withOptions(
  common: Omit<RequestChoiceField, "kind" | "options">,
  options: unknown,
): RequestChoiceField | undefined {
  if (!Array.isArray(options)) return undefined;

  const values: readonly unknown[] = options;
  const texts = values.filter(isText);
  const isSoundList =
    texts.length === values.length &&
    texts.length > 0 &&
    texts.length <= MAX_OPTIONS &&
    new Set(texts).size === texts.length;
  return isSoundList
    ? { kind: "choice", ...common, options: texts }
    : undefined;
}

function isRequestFieldKind(value: unknown): value is RequestFieldKind {
  return REQUEST_FIELD_KINDS.some((kind) => kind === value);
}

function invalidForm(reason: RequestFormProblemReason): RequestFormReading {
  return { status: "invalid", reason };
}
