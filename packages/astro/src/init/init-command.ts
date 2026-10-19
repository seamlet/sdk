import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readSiteConfig, SITE_CONFIG_FILE } from "../schema";
import { siteFilesOf, siteIdOf } from "./site-files";
import { writeSiteFiles } from "./write-site-files";

// `npx @seamlet/astro init`: starts a site's connection to the CMS in the Astro project it runs in.

/** The CMS a site belongs to unless `--cms` names another. */
const DEFAULT_CMS = "https://cms.seamlet.ru";
const SUCCESS = 0;
const FAILURE = 1;
const MISUSE = 2;

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

  const packageName = await packageNameOf(run.root);
  const id = options.id ?? siteIdOf(packageName ?? "");
  const reading = readSiteConfig({
    id,
    title: options.title ?? id,
    cms: options.cms ?? DEFAULT_CMS,
  });
  if (reading.status === "invalid") {
    const fields = reading.invalidFields
      .map((field) => `--${field}`)
      .join(", ");
    run.log(`Give the site ${fields}.\n\n${USAGE}`);
    return FAILURE;
  }

  const files = await writeSiteFiles(run.root, siteFilesOf(reading.config));
  for (const path of files.written) run.log(`wrote ${path}`);
  for (const path of files.kept)
    run.log(`kept ${path}: the site has it already`);
  run.log(NEXT_STEPS);
  return SUCCESS;
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
