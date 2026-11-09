import { isJsonObject, isText } from "./json-values";

// What a site says about itself in `seamlet.json` at the root of its repository: what is known before
// the site is built (its id and name in the CMS, the CMS it belongs to). The site's build takes it
// from there, and the CMS reads the same file from the repository with this code, so a site's id is
// written once.

/** The file at the root of a site's repository. */
export const SITE_CONFIG_FILE = "seamlet.json";

/**
 * An id is a part of addresses, of file names and of the host of the site's preview
 * (`<id>.preview.…`): lower-case letters, digits and hyphens.
 */
const SITE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
/** A label of a host name holds at most this many characters. */
const LONGEST_SITE_ID = 63;
const WEB_PROTOCOLS = new Set(["https:", "http:"]);
/** The token the CMS gives a site's owner: letters, digits, `_` and `-`, long enough to guess at none. */
const OWNER_TOKEN = /^[A-Za-z0-9_-]{16,128}$/u;

export interface SiteConfig {
  /** The site's id in the CMS: its address there (`/sites/<id>`) and the name of its content. */
  readonly id: string;
  /** How the CMS names the site: «Моя кофейня». */
  readonly title: string;
  /** The origin of the CMS the site belongs to: `https://cms.seamlet.ru`. */
  readonly cms: string;
  /**
   * The token the CMS gave the account that connects the site. The site hands it back in its
   * description, so the CMS knows the person who connects it is the one who deploys it. Not a
   * secret: it proves only who took it from the CMS.
   */
  readonly ownerToken?: string;
}

export type SiteConfigField = keyof SiteConfig;

/** The fields in the order a person reads them in the file. */
const SITE_CONFIG_FIELDS: readonly SiteConfigField[] = [
  "id",
  "title",
  "cms",
  "ownerToken",
];

export type SiteConfigReading =
  | { readonly status: "read"; readonly config: SiteConfig }
  | {
      readonly status: "invalid";
      /** The fields that are missing or not what they must be. */
      readonly invalidFields: readonly SiteConfigField[];
    };

export function isOwnerToken(value: unknown): value is string {
  return typeof value === "string" && OWNER_TOKEN.test(value);
}

export function isSiteId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= LONGEST_SITE_ID &&
    SITE_ID.test(value)
  );
}

/** The config the input gives (the parsed `seamlet.json`); fields it does not know are left out. */
export function readSiteConfig(input: unknown): SiteConfigReading {
  const fields = isJsonObject(input) ? input : {};
  const { id, title, ownerToken } = fields;
  const cms = originOf(fields["cms"]);

  const hasId = isSiteId(id);
  const hasTitle = isText(title);
  const hasCms = cms !== undefined;
  const isOwnerTokenSound =
    ownerToken === undefined || isOwnerToken(ownerToken);
  if (hasId && hasTitle && hasCms && isOwnerTokenSound) {
    const owned = ownerToken === undefined ? {} : { ownerToken };
    const config = { id, title: title.trim(), cms, ...owned };
    return { status: "read", config };
  }

  const validity: Readonly<Record<SiteConfigField, boolean>> = {
    id: hasId,
    title: hasTitle,
    cms: hasCms,
    ownerToken: isOwnerTokenSound,
  };
  const invalidFields = SITE_CONFIG_FIELDS.filter((field) => !validity[field]);
  return { status: "invalid", invalidFields };
}

/** The origin of an http(s) address: `https://cms.seamlet.ru/` and `https://cms.seamlet.ru` alike. */
function originOf(value: unknown): string | undefined {
  if (typeof value !== "string" || !URL.canParse(value)) return undefined;
  const url = new URL(value);
  return WEB_PROTOCOLS.has(url.protocol) ? url.origin : undefined;
}
