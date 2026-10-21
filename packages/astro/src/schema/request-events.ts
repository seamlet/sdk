import type { RequestEntries, RequestIssue } from "./request-values";

// What the site's own code hears of its forms of requests: events on the form element, which bubble,
// so a script of the site listens on the form or on the document. A site adds what it needs without
// a change of the package: a goal of its analytics, its own message, its own way to send.

/**
 * Before the request is sent, once the form takes what was typed. Cancelable: a site that calls
 * `preventDefault()` sends the request its own way, and the package sends nothing.
 */
export const REQUEST_SEND_EVENT = "seamlet:request-send";
/** The CMS has kept the request. */
export const REQUEST_SENT_EVENT = "seamlet:request-sent";
/** The CMS has not kept the request: what was typed is still in the form. */
export const REQUEST_FAILED_EVENT = "seamlet:request-failed";

export interface RequestSendDetail {
  /** The id of the form: `callback`. */
  readonly form: string;
  /** What the request sends: the fields by their names, and the request's own keys. */
  readonly entries: RequestEntries;
}

export interface RequestSentDetail extends RequestSendDetail {
  /** The id the CMS gave the request. */
  readonly id: string;
}

/** Why the CMS did not keep the request. */
export type RequestFailure =
  /** A field the CMS could not take; `issues` names them. */
  | "invalid"
  /** The business does not take requests yet: its texts of consent are not confirmed. */
  | "closed"
  /** Too many requests from the same visitor; a later one is taken. */
  | "too-many"
  /** The CMS could not be reached, or answered with an error. */
  | "unavailable";

export interface RequestFailedDetail {
  readonly form: string;
  readonly reason: RequestFailure;
  readonly issues: readonly RequestIssue[];
}
