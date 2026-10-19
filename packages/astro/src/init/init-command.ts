import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  readSiteConfig,
  SITE_CONFIG_FILE,
  type SiteConfigReading,
} from "../schema";
import { configFileOf, moduleFilesOf, siteIdOf } from "./site-files";
import { hasCode, writeSiteFiles, type WrittenFiles } from "./write-site-files";

// `npx @seamlet/astro init`: starts a site's connection to the CMS in the Astro project it runs in.

/** The CMS a site belongs to unless `--cms` names another. */
const DEFAULT_CMS = "https://cms.seamlet.ru";
const SUCCESS = 0;
const FAILURE = 1;
const MISUSE = 2;
const MISSING = "ENOENT";

const USAGE = `Usage: npx @seamlet/astro init [--id <id>] [--title <title>] [--cms <address>]

Writes ${SITE_CONFIG_FILE} and a first module of the site in the Astro project here. The id is the
site's name in the CMS (lower-case letters, digits and hyphens); by default it comes from the
name in package.json, the title from the id, the CMS is ${DEFAULT_CMS}.`;

const NEXT_STEPS = `
Next:
  npx astro add @seamlet/astro node    the integration, and an adapter for the preview
  render a page with its content, such as src/pages/index.astro:
    ---
    import site from "../seamlet";
    import HomePage from "../components/HomePage.astro";
    const content = await site.loadPublishedContent();
    ---
    <HomePage content={content} />`;

export interface InitRun {
  /** The folder of the Astro project. */
  readonly root: string;
  /** The arguments after the package's name: `init --id coffee-shop`. */
  readonly argv: readonly string[];
  readonly log: (line: string) => void;
}

/** Runs the command; resolves with the process's exit code. */
export async function runInit(run: InitRun): Promise<number> {
  const options = optionsOf(run.argv);
  if (options === undefined) {
    run.log(USAGE);
    return MISUSE;
  }

  const existing = await existingConfigOf(run.root);
  const reading = existing ?? (await configOfOptions(run.root, options));
  if (reading.status === "invalid") {
    run.log(invalidConfigMessage(reading, existing !== undefined));
    return FAILURE;
  }

  const config = reading.config;
  const configFile = await writeSiteFiles(run.root, [configFileOf(config)]);
  const moduleFiles = await writeSiteFiles(run.root, moduleFilesOf(config));
  logWritten(run, configFile);
  logWritten(run, moduleFiles);
  run.log(NEXT_STEPS);
  return SUCCESS;
}

/** The config the options give, with the id from package.json and the title from the id by default. */
async function configOfOptions(
  root: string,
  options: InitOptions,
): Promise<SiteConfigReading> {
  const packageName = await packageNameOf(root);
  const id = options.id ?? siteIdOf(packageName ?? "");
  return readSiteConfig({
    id,
    title: options.title ?? id,
    cms: options.cms ?? DEFAULT_CMS,
  });
}

/**
 * The site's own `seamlet.json`, which the modules are written for when it is there: modules named
 * after another id would show another site's content. Undefined when the site has none.
 */
async function existingConfigOf(
  root: string,
): Promise<SiteConfigReading | undefined> {
  const path = join(root, SITE_CONFIG_FILE);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (hasCode(error, MISSING)) return undefined;
    throw new Error(`@seamlet/astro: cannot read ${path}`, { cause: error });
  }
  return readSiteConfig(parsedOrNothing(text));
}

function parsedOrNothing(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Not JSON: every field of the config is missing, and the message names them.
    return undefined;
  }
}

function invalidConfigMessage(
  reading: Extract<SiteConfigReading, { status: "invalid" }>,
  isExisting: boolean,
): string {
  if (isExisting) {
    const fields = reading.invalidFields
      .map((field) => `"${field}"`)
      .join(", ");
    return `The site's ${SITE_CONFIG_FILE} needs ${fields}: fix it, or remove it to write a new one.`;
  }
  const options = reading.invalidFields.map((field) => `--${field}`).join(", ");
  return `Give the site ${options}.\n\n${USAGE}`;
}

function logWritten(run: InitRun, files: WrittenFiles): void {
  for (const path of files.written) run.log(`wrote ${path}`);
  for (const path of files.kept) {
    run.log(
      `kept ${path}: the site has it, or a file that goes with it, already`,
    );
  }
}

interface InitOptions {
  readonly id: string | undefined;
  readonly title: string | undefined;
  readonly cms: string | undefined;
}

/** The options of `init`, or undefined for any other command or an option it does not know. */
function optionsOf(argv: readonly string[]): InitOptions | undefined {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        id: { type: "string" },
        title: { type: "string" },
        cms: { type: "string" },
      },
    });
    const isInit = positionals.length === 1 && positionals[0] === "init";
    return isInit
      ? { id: values.id, title: values.title, cms: values.cms }
      : undefined;
  } catch {
    // An option parseArgs does not know: the usage says which there are.
    return undefined;
  }
}

/** The project's name, or undefined for a project without a readable package.json: then --id names the site. */
async function packageNameOf(root: string): Promise<string | undefined> {
  try {
    const manifest: unknown = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    );
    const name = (manifest as { name?: unknown } | null)?.name;
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
}
