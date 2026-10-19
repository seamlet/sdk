import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SiteFile } from "./site-files";

// Writes the files of a new site without touching any the site has already. Files that belong
// together (a module and the schema and page it imports) are written all or none: half of them
// next to the site's own would not build.

export interface WrittenFiles {
  readonly written: readonly string[];
  /** Files left as they are, because the site has them, or one of the files they go with. */
  readonly kept: readonly string[];
}

const ALREADY_EXISTS = "EEXIST";
const MISSING = "ENOENT";

/** Writes the files, or none of them when the site has any of them already. */
export async function writeSiteFiles(
  root: string,
  files: readonly SiteFile[],
): Promise<WrittenFiles> {
  const paths = files.map((file) => file.path);
  if (await isAnyThere(root, paths)) return { written: [], kept: paths };

  for (const file of files) {
    await writeNewFile(join(root, file.path), file.text);
  }
  return { written: paths, kept: [] };
}

/** Looked at one by one, so a folder that cannot be read is named the same every time. */
async function isAnyThere(
  root: string,
  paths: readonly string[],
): Promise<boolean> {
  for (const path of paths) {
    if (await isThere(join(root, path))) return true;
  }
  return false;
}

async function isThere(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (hasCode(error, MISSING)) return false;
    throw new Error(`@seamlet/astro: cannot read ${path}`, { cause: error });
  }
}

/** Writes the file, failing rather than overwriting one that appeared meanwhile. */
async function writeNewFile(path: string, text: string): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, { flag: "wx" });
  } catch (error) {
    const reason = hasCode(error, ALREADY_EXISTS)
      ? " (it appeared meanwhile)"
      : "";
    throw new Error(`@seamlet/astro: cannot write ${path}${reason}`, {
      cause: error,
    });
  }
}

/** Whether the error of the file system has the code (`ENOENT`, `EEXIST`). */
export function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
