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

export interface SiteConfig {
  /** The site's id in the CMS: its address there (`/sites/<id>`) and the name of its content. */
  readonly id: string;
  /** How the CMS names the site: «Кофейня «Зерно»». */
  readonly title: string;
  /** The origin of the CMS the site belongs to: `https://cms.seamlet.ru`. */
  readonly cms: string;
}

export type SiteConfigField = keyof SiteConfig;

/** The fields in the order a person reads them in the file. */
const SITE_CONFIG_FIELDS: readonly SiteConfigField[] = ["id", "title", "cms"];

export type SiteConfigReading =
  | { readonly status: "read"; readonly config: SiteConfig }
  | {
      readonly status: "invalid";
      /** The fields that are missing or not what they must be. */
      readonly invalidFields: readonly SiteConfigField[];
    };

export function isSiteId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= LONGEST_SITE_ID &&
    SITE_ID.test(value)
  );
}

/** The config the input gives (the parsed `seamlet.json`); fields it does not know are left out. */
export function readSiteConfig(input: unknown): SiteConfigReading {
  const fields = isRecord(input) ? input : {};
  const { id, title } = fields;
  const cms = originOf(fields["cms"]);

  const hasId = isSiteId(id);
  const hasTitle = isText(title);
  const hasCms = cms !== undefined;
  if (hasId && hasTitle && hasCms) {
    return { status: "read", config: { id, title: title.trim(), cms } };
  }

  const validity: Readonly<Record<SiteConfigField, boolean>> = {
    id: hasId,
    title: hasTitle,
    cms: hasCms,
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

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
