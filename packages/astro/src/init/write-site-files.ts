import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SiteFile } from "./site-files";

// Writes the files of a new site without touching any the site has already.

export interface WrittenFiles {
  readonly written: readonly string[];
  /** Files the site has already, left as they are. */
  readonly kept: readonly string[];
}

const ALREADY_EXISTS = "EEXIST";

export async function writeSiteFiles(
  root: string,
  files: readonly SiteFile[],
): Promise<WrittenFiles> {
  const written: string[] = [];
  const kept: string[] = [];
  for (const file of files) {
    const isWritten = await writeNewFile(join(root, file.path), file.text);
    (isWritten ? written : kept).push(file.path);
  }
  return { written, kept };
}

/** Writes the file unless it exists; whether it was written. */
async function writeNewFile(path: string, text: string): Promise<boolean> {
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, text, { flag: "wx" });
    return true;
  } catch (error) {
    if (isAlreadyThere(error)) return false;
    throw new Error(`@seamlet/astro: cannot write ${path}`, { cause: error });
  }
}

function isAlreadyThere(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && error.code === ALREADY_EXISTS
  );
}
