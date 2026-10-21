// The site's forms of requests, sent in place. A form rendered by `RequestForm.astro` is a plain
// form posted to the CMS, which answers with a page of its own; with this script the visitor stays
// on the page: the form checks what was typed with the code the CMS checks it with, sends it, and
// says how it went in the form's own words. The site's code hears every step (request-events.ts).
//
// The CMS answers the route with CORS on every answer and on the preflight, so an answer it gives
// is always read here.

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
import { REQUEST_FORM_SELECTOR } from "./request-form-markers";

/** How the CMS answers: kept, every field it cannot take, or a refusal. */
const STATUS_CREATED = 201;
const STATUS_UNPROCESSABLE = 422;
const STATUS_CONFLICT = 409;
const STATUS_TOO_MANY = 429;
/** A CMS that has not answered by then will not: the visitor is told so and may try again. */
const ANSWER_TIMEOUT_MS = 15_000;

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
  /** The site's own policy stopped the request before it left: the browser may post the form. */
  | { readonly kind: "blocked" };

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
    if (options.isPreview) keepFromSending(element);
    else connectRequestForm(element);
  }
}

function keepFromSending(element: HTMLFormElement): void {
  element.addEventListener("submit", (event) => {
    event.preventDefault();
  });
}

function connectRequestForm(element: HTMLFormElement): void {
  const form = formOf(element);
  // A form the script cannot read stays a plain form: the CMS checks what is posted.
  if (form === undefined) return;

  // The script says what to fix in the form's words, the same for every browser.
  element.noValidate = true;
  element.addEventListener("submit", (event) => {
    event.preventDefault();
    const isSending = element.dataset["seamletState"] === "sending";
    if (!isSending) void sendRequest(element, form);
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
  showState(element, "editing");
  const entries = entriesOf(element);
  const issues = issuesOf(form, entries);
  showIssues(element, issues);
  if (issues.length > 0) {
    focusFirstIssue(element, issues);
    return;
  }

  const isSentBySite = !element.dispatchEvent(
    new CustomEvent<RequestSendDetail>(REQUEST_SEND_EVENT, {
      bubbles: true,
      cancelable: true,
      detail: { form: form.id, entries },
    }),
  );
  if (isSentBySite) return;

  showState(element, "sending");
  // A control named `action` takes the place of the form's property: the attribute is read.
  const outcome = await post(element.getAttribute("action") ?? "", entries);
  settle(element, { form, entries, outcome });
}

interface Sending {
  readonly form: RequestForm;
  readonly entries: RequestEntries;
  readonly outcome: Outcome;
}

function settle(element: HTMLFormElement, sending: Sending): void {
  const { form, entries, outcome } = sending;
  switch (outcome.kind) {
    case "received":
      showState(element, "sent");
      // A control named `reset` takes the place of the form's own method: the prototype's is called.
      HTMLFormElement.prototype.reset.call(element);
      announceSent(element, { form: form.id, entries, id: outcome.id });
      return;
    case "refused":
      showState(element, "failed");
      showIssues(element, outcome.issues);
      focusFirstIssue(element, outcome.issues);
      announceFailure(element, {
        form: form.id,
        reason: outcome.reason,
        issues: outcome.issues,
      });
      return;
    case "blocked":
      // The browser posts the form itself, and the CMS answers with its own page.
      HTMLFormElement.prototype.submit.call(element);
  }
}

function announceSent(
  element: HTMLFormElement,
  detail: RequestSentDetail,
): void {
  element.dispatchEvent(
    new CustomEvent<RequestSentDetail>(REQUEST_SENT_EVENT, {
      bubbles: true,
      detail,
    }),
  );
}

function announceFailure(
  element: HTMLFormElement,
  detail: RequestFailedDetail,
): void {
  element.dispatchEvent(
    new CustomEvent<RequestFailedDetail>(REQUEST_FAILED_EVENT, {
      bubbles: true,
      detail,
    }),
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

/**
 * Sends the request and reads the answer. Only a request the page's own policy stopped is posted
 * again by the browser: one that failed on its way may have reached the CMS, which would then keep
 * it twice.
 */
async function post(action: string, entries: RequestEntries): Promise<Outcome> {
  const blocked = watchBlocking(action);
  try {
    const answer = await fetch(action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(entries),
      signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
    });
    return await outcomeOf(answer);
  } catch {
    return blocked.isBlocked()
      ? { kind: "blocked" }
      : { kind: "refused", reason: "unavailable", issues: [] };
  } finally {
    blocked.stop();
  }
}

interface BlockingWatch {
  readonly isBlocked: () => boolean;
  readonly stop: () => void;
}

/** Whether the page's Content-Security-Policy stops a request to the action's origin meanwhile. */
function watchBlocking(action: string): BlockingWatch {
  const target = new URL(action, document.baseURI).origin;
  let isBlocked = false;
  const hear = (event: SecurityPolicyViolationEvent) => {
    if (originOf(event.blockedURI) === target) isBlocked = true;
  };
  document.addEventListener("securitypolicyviolation", hear);
  return {
    isBlocked: () => isBlocked,
    stop: () => {
      document.removeEventListener("securitypolicyviolation", hear);
    },
  };
}

function originOf(address: string): string | undefined {
  try {
    return new URL(address).origin;
  } catch {
    return undefined;
  }
}

async function outcomeOf(answer: Response): Promise<Outcome> {
  const body: unknown = await answer.json().catch(() => undefined);
  const record = isJsonObject(body) ? body : {};
  const id = record["id"];
  if (answer.status === STATUS_CREATED && typeof id === "string") {
    return { kind: "received", id };
  }
  if (answer.status === STATUS_UNPROCESSABLE) {
    const issues = readIssues(record["issues"]);
    return { kind: "refused", reason: "invalid", issues };
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

function controlOf(
  element: HTMLFormElement,
  field: string,
): HTMLElement | undefined {
  // A field's name is a name of a property or one of the request's own keys: nothing to quote.
  const control = element.querySelector(`[name="${field}"]`);
  return control instanceof HTMLElement ? control : undefined;
}

function markControl(
  element: HTMLFormElement,
  field: string,
  isInvalid: boolean,
): void {
  const control = controlOf(element, field);
  if (isInvalid) control?.setAttribute("aria-invalid", "true");
  else control?.removeAttribute("aria-invalid");
}

function focusFirstIssue(
  element: HTMLFormElement,
  issues: readonly RequestIssue[],
): void {
  const [first] = issues;
  if (first !== undefined) controlOf(element, first.field)?.focus();
}

type FormState = "editing" | "sending" | "sent" | "failed";

/**
 * The form says where it is: its button waits while sending, and one message tells the outcome. The
 * messages stay in the page, live and empty, and get their words when they are to be heard, so a
 * screen reader says them every time.
 */
function showState(element: HTMLFormElement, state: FormState): void {
  element.dataset["seamletState"] = state;
  const submit = element.querySelector<HTMLButtonElement>("[type=submit]");
  if (submit !== null) submit.disabled = state === "sending";

  const sent = element.querySelector<HTMLElement>("[data-seamlet-sent]");
  const failure = element.querySelector<HTMLElement>("[data-seamlet-failed]");
  say(sent, state === "sent");
  say(failure, state === "failed");
  // The button that had the focus waits while sending; the message of the outcome takes it.
  if (state === "sent") sent?.focus();
}

function say(message: HTMLElement | null, isSaid: boolean): void {
  if (message === null) return;

  message.textContent = isSaid ? (message.dataset["seamletText"] ?? "") : "";
}
