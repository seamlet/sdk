import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  readSiteConfig,
  SITE_CONFIG_FILE,
  type SiteConfig,
  type SiteConfigField,
} from "./schema";

// The site's `seamlet.json`, read when the site is built or served. A build that cannot read it
// stops at once and says what to fix: a site with a wrong id would take another site's content.

/** What a field of `seamlet.json` must be, for the message about it. */
const FIELD_RULES: Readonly<Record<SiteConfigField, string>> = {
  id: "the site's id in the CMS: lower-case letters, digits and single hyphens, such as coffee-shop",
  title: "how the CMS names the site, such as «Кофейня «Зерно»»",
  cms: "the address of the CMS, such as https://cms.seamlet.ru",
};

/**
 * The config in `seamlet.json` at the site's root. `cmsOverride` takes the place of its `cms` when
 * given: the environment's `CMS_ORIGIN`, which a build for another CMS (development, the CMS's
 * builder) sets. An empty one is not given: an image built without the build argument has it so.
 */
export async function loadSiteConfig(
  root: URL,
  cmsOverride: string | undefined,
): Promise<SiteConfig> {
  const file = new URL(SITE_CONFIG_FILE, root);
  const parsed = await readJsonFile(file);
  const isOverridden = cmsOverride !== undefined && cmsOverride !== "";
  const input = isOverridden
    ? { ...asObject(parsed), cms: cmsOverride }
    : parsed;

  const reading = readSiteConfig(input);
  if (reading.status === "read") return reading.config;
  throw new Error(invalidFieldsMessage(file, reading.invalidFields));
}

async function readJsonFile(file: URL): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    throw new Error(
      `@seamlet/astro: ${fileURLToPath(file)} is missing: the site names its id, its title and its CMS there`,
      { cause: error },
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`@seamlet/astro: ${fileURLToPath(file)} is not JSON`, {
      cause: error,
    });
  }
}

function asObject(value: unknown): object {
  return typeof value === "object" && value !== null ? value : {};
}

function invalidFieldsMessage(
  file: URL,
  fields: readonly SiteConfigField[],
): string {
  const lines = fields.map((field) => `  "${field}": ${FIELD_RULES[field]}`);
  return [
    `@seamlet/astro: ${fileURLToPath(file)} needs these fields:`,
    ...lines,
  ].join("\n");
}
