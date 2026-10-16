// Where a link of a site may lead: one of its own pages, another site, a phone or an email.
// Nothing else is a link a site's owner can set: an address like `javascript:` would run code on
// the site, so the same rule checks content on saving and builds addresses in the editor.

/** Where a link leads, as the editor offers it. */
export type LinkTarget =
  | { readonly kind: "page"; readonly path: string }
  | { readonly kind: "web"; readonly url: string }
  | { readonly kind: "phone"; readonly number: string }
  | { readonly kind: "email"; readonly address: string };

export type LinkKind = LinkTarget["kind"];

const PHONE_PREFIX = "tel:";
const EMAIL_PREFIX = "mailto:";
const WEB_PREFIX = "https://";
/** A stand-in origin of the site: a path of the site resolves against it and stays on it. */
const SITE_ORIGIN = "https://site.invalid";
/** Below this code a character is a control character, which browsers drop from a URL. */
const FIRST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;
const BACKSLASH_CODE = 0x5c;
const WEB_ADDRESS = /^https?:\/\/[^\s/?#]+[^\s]*$/iu;
/** `mailto:`, `javascript:`, but not `zerno.ru:8080`, where a port follows the colon. */
const ANY_SCHEME = /^[a-z][a-z\d+.-]*:(?!\d)/iu;
const PHONE_NUMBER = /^\+?[\d\s().-]*\d[\d\s().-]*$/u;
const NOT_PHONE_DIGIT = /[^\d+]/gu;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Where the address leads, or undefined for an address a link of a site may not have. The address
 * is checked exactly as it is stored and rendered: spaces around it make it no address at all.
 */
export function linkTargetOf(href: string): LinkTarget | undefined {
  const address = href;
  const hasSpacesAround = address !== address.trim();
  if (hasSpacesAround) {
    return undefined;
  }
  if (isSitePath(address)) {
    return { kind: "page", path: address };
  }
  if (WEB_ADDRESS.test(address)) {
    return { kind: "web", url: address };
  }
  const phone = withoutPrefix(address, PHONE_PREFIX);
  if (phone !== undefined && PHONE_NUMBER.test(phone)) {
    return { kind: "phone", number: phone };
  }
  const email = withoutPrefix(address, EMAIL_PREFIX);
  if (email !== undefined && EMAIL_ADDRESS.test(email)) {
    return { kind: "email", address: email };
  }
  return undefined;
}

/**
 * The address of a link from what a person typed: a phone or an email without `tel:` or
 * `mailto:`, a site without `https://`.
 */
export function hrefOf(target: LinkTarget): string {
  switch (target.kind) {
    case "page":
      return target.path.trim();
    case "web":
      return webAddressOf(target.url.trim());
    case "phone":
      return `${PHONE_PREFIX}${target.number.replace(NOT_PHONE_DIGIT, "")}`;
    case "email":
      return `${EMAIL_PREFIX}${target.address.trim()}`;
  }
}

function webAddressOf(typed: string): string {
  const hasScheme = ANY_SCHEME.test(typed);
  return hasScheme || typed === "" ? typed : `${WEB_PREFIX}${typed}`;
}

function isSitePath(address: string): boolean {
  if (!address.startsWith("/") || hasAmbiguousCharacter(address)) {
    return false;
  }
  return new URL(address, SITE_ORIGIN).origin === SITE_ORIGIN;
}

/**
 * Whether a browser would read the address differently from how it is written: a backslash is a
 * slash to it, tabs and line breaks it drops. With them `/\\evil.example` or `/<tab>/evil.example`
 * would lead off the site.
 */
function hasAmbiguousCharacter(address: string): boolean {
  const codes = Array.from({ length: address.length }, (_, index) =>
    address.charCodeAt(index),
  );
  return codes.some(
    (code) =>
      code === BACKSLASH_CODE ||
      code < FIRST_PRINTABLE_CODE ||
      code === DELETE_CODE,
  );
}

function withoutPrefix(address: string, prefix: string): string | undefined {
  const hasPrefix = address.toLowerCase().startsWith(prefix);
  return hasPrefix ? address.slice(prefix.length) : undefined;
}
