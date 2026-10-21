// The site's forms of requests, sent in place. A form rendered by `RequestForm.astro` is a plain
// form posted to the CMS, which answers with a page of its own; with this script the visitor stays
// on the page: the form checks what was typed with the code the CMS checks it with, sends it, and
// says how it went in the form's own words. The site's code hears every step (request-events.ts).

import {
  CONSENT_REQUIRED_TEXT,
  isConsentGiven,
  isJsonObject,
  readRequestForm,
  readRequestValues,
  REQUEST_CONSENT_KEY,
  REQUEST_FAILED_EVENT,
  REQUEST_ISSUE_TEXTS,
  REQUEST_SEND_EVENT,
  REQUEST_SENT_EVENT,
  type RequestEntries,
  type RequestFailedDetail,
  type RequestFailure,
  type RequestForm,
  type RequestIssue,
  type RequestIssueCode,
  type RequestSendDetail,
  type RequestSentDetail,
} from "./schema";

/** The forms the script sends: `RequestForm.astro` marks them with the form's id. */
export const REQUEST_FORM_SELECTOR = "form[data-seamlet-form]";

/** How the CMS answers: kept, every field it cannot take, or a refusal. */
const STATUS_CREATED = 201;
const STATUS_UNPROCESSABLE = 422;
const STATUS_CONFLICT = 409;
const STATUS_TOO_MANY = 429;

const ISSUE_CODES: readonly RequestIssueCode[] = [
  "required",
  "too-long",
  "invalid-phone",
  "invalid-email",
  "unknown-option",
];

type Outcome =
  | { readonly kind: "received"; readonly id: string }
  | {
      readonly kind: "refused";
      readonly reason: RequestFailure;
      readonly issues: readonly RequestIssue[];
    }
  /** No answer at all: a network that is down, or a policy of the site that stops the request. */
  | { readonly kind: "unreachable" };

export interface RequestFormsOptions {
  /** In the editor's preview a form sends nothing: the owner is editing, not asking. */
  readonly isPreview: boolean;
}

/** Makes every form of requests on the page send itself in place. */
export function connectRequestForms(
  root: ParentNode,
  options: RequestFormsOptions,
): void {
  const elements = root.querySelectorAll<HTMLFormElement>(
    REQUEST_FORM_SELECTOR,
  );
  for (const element of elements) {
    if (options.isPreview) {
      element.addEventListener("submit", (event) => {
        event.preventDefault();
      });
      continue;
    }
    connectRequestForm(element);
  }
}

function connectRequestForm(element: HTMLFormElement): void {
  const form = formOf(element);
  // A form the script cannot read stays a plain form: the CMS checks what is posted.
  if (form === undefined) return;

  // The script says what to fix in the form's words, the same for every browser.
  element.noValidate = true;
  element.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendRequest(element, form);
  });
}

function formOf(element: HTMLFormElement): RequestForm | undefined {
  const declared = element.dataset["seamletRequestForm"];
  if (declared === undefined) return undefined;

  try {
    const reading = readRequestForm(JSON.parse(declared));
    return reading.status === "read" ? reading.form : undefined;
  } catch {
    return undefined;
  }
}

async function sendRequest(
  element: HTMLFormElement,
  form: RequestForm,
): Promise<void> {
  const entries = entriesOf(element);
  const issues = issuesOf(form, entries);
  showIssues(element, issues);
  if (issues.length > 0) {
    focusFirstIssue(element, issues);
    return;
  }

  const sendDetail: RequestSendDetail = { form: form.id, entries };
  const isSentBySite = !element.dispatchEvent(
    new CustomEvent(REQUEST_SEND_EVENT, {
      bubbles: true,
      cancelable: true,
      detail: sendDetail,
    }),
  );
  if (isSentBySite) return;

  showState(element, "sending");
  const outcome = await post(element.action, entries);
  settle(element, form, entries, outcome);
}

function settle(
  element: HTMLFormElement,
  form: RequestForm,
  entries: RequestEntries,
  outcome: Outcome,
): void {
  switch (outcome.kind) {
    case "received": {
      showState(element, "sent");
      element.reset();
      const detail: RequestSentDetail = {
        form: form.id,
        entries,
        id: outcome.id,
      };
      element.dispatchEvent(
        new CustomEvent(REQUEST_SENT_EVENT, { bubbles: true, detail }),
      );
      return;
    }
    case "refused":
      showState(element, "failed");
      showIssues(element, outcome.issues);
      failed(element, form, outcome.reason, outcome.issues);
      return;
    case "unreachable":
      // Online, the request was stopped on its way, as a policy of the site does: the browser
      // posts the form itself, and the CMS answers with its own page.
      if (navigator.onLine) {
        element.submit();
        return;
      }
      showState(element, "failed");
      failed(element, form, "unavailable", []);
  }
}

function failed(
  element: HTMLFormElement,
  form: RequestForm,
  reason: RequestFailure,
  issues: readonly RequestIssue[],
): void {
  const detail: RequestFailedDetail = { form: form.id, reason, issues };
  element.dispatchEvent(
    new CustomEvent(REQUEST_FAILED_EVENT, { bubbles: true, detail }),
  );
}

/** What the form sends: every named control's words, as a posted form sends them. */
function entriesOf(element: HTMLFormElement): RequestEntries {
  const data = new FormData(element);
  const pairs = [...data].flatMap(([name, value]) =>
    typeof value === "string" ? [[name, value] as const] : [],
  );
  return Object.fromEntries(pairs);
}

function issuesOf(
  form: RequestForm,
  entries: RequestEntries,
): readonly RequestIssue[] {
  const reading = readRequestValues(form, entries);
  const fieldIssues = reading.status === "invalid" ? reading.issues : [];
  const consentIssues: readonly RequestIssue[] = isConsentGiven(entries)
    ? []
    : [{ field: REQUEST_CONSENT_KEY, code: "required" }];
  return [...fieldIssues, ...consentIssues];
}

async function post(action: string, entries: RequestEntries): Promise<Outcome> {
  let answer: Response;
  try {
    answer = await fetch(action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(entries),
    });
  } catch {
    return { kind: "unreachable" };
  }
  return outcomeOf(answer);
}

async function outcomeOf(answer: Response): Promise<Outcome> {
  const body: unknown = await answer.json().catch(() => undefined);
  const record = isJsonObject(body) ? body : {};
  if (answer.status === STATUS_CREATED && typeof record["id"] === "string") {
    return { kind: "received", id: record["id"] };
  }
  if (answer.status === STATUS_UNPROCESSABLE) {
    return {
      kind: "refused",
      reason: "invalid",
      issues: readIssues(record["issues"]),
    };
  }
  return { kind: "refused", reason: failureOf(answer.status), issues: [] };
}

function failureOf(status: number): RequestFailure {
  if (status === STATUS_CONFLICT) return "closed";
  if (status === STATUS_TOO_MANY) return "too-many";
  return "unavailable";
}

function readIssues(input: unknown): readonly RequestIssue[] {
  if (!Array.isArray(input)) return [];

  const entries: readonly unknown[] = input;
  return entries.flatMap((entry) => {
    if (!isJsonObject(entry)) return [];
    const { field, code } = entry;
    const isIssue = typeof field === "string" && isIssueCode(code);
    return isIssue ? [{ field, code }] : [];
  });
}

function isIssueCode(value: unknown): value is RequestIssueCode {
  return ISSUE_CODES.some((code) => code === value);
}

/** Every field says what to fix under it, and the others say nothing. */
function showIssues(
  element: HTMLFormElement,
  issues: readonly RequestIssue[],
): void {
  const messages = element.querySelectorAll<HTMLElement>(
    "[data-seamlet-issue]",
  );
  for (const message of messages) {
    const field = message.dataset["seamletIssue"] ?? "";
    const issue = issues.find((candidate) => candidate.field === field);
    message.textContent = issue === undefined ? "" : issueText(issue);
    message.hidden = issue === undefined;
    markControl(element, field, issue !== undefined);
  }
}

function issueText(issue: RequestIssue): string {
  return issue.field === REQUEST_CONSENT_KEY
    ? CONSENT_REQUIRED_TEXT
    : REQUEST_ISSUE_TEXTS[issue.code];
}

function markControl(
  element: HTMLFormElement,
  field: string,
  isInvalid: boolean,
): void {
  const control = element.elements.namedItem(field);
  if (!(control instanceof HTMLElement)) return;

  if (isInvalid) control.setAttribute("aria-invalid", "true");
  else control.removeAttribute("aria-invalid");
}

function focusFirstIssue(
  element: HTMLFormElement,
  issues: readonly RequestIssue[],
): void {
  const [first] = issues;
  if (first === undefined) return;

  const control = element.elements.namedItem(first.field);
  if (control instanceof HTMLElement) control.focus();
}

type FormState = "sending" | "sent" | "failed";

/** The form says where it is: its button waits while sending, and one message shows the outcome. */
function showState(element: HTMLFormElement, state: FormState): void {
  element.dataset["seamletState"] = state;
  const submit = element.querySelector<HTMLButtonElement>("[type=submit]");
  if (submit !== null) submit.disabled = state === "sending";

  const sent = element.querySelector<HTMLElement>("[data-seamlet-sent]");
  const failure = element.querySelector<HTMLElement>("[data-seamlet-failed]");
  if (sent !== null) sent.hidden = state !== "sent";
  if (failure !== null) failure.hidden = state !== "failed";
}
