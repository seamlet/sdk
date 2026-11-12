import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isCopyOnly } from "./content-copies";
import { CONTENT_COPY_FILE, CONTENT_COPY_MEDIA_FOLDER } from "./site-addresses";

/** What the build knows of the site's copy of its content: the files at its root. */
export interface ContentCopyFiles {
  /** The text of `seamlet/content.json`; undefined when the site has none. */
  readonly text: string | undefined;
  /** Whether `SEAMLET_CONTENT=copy` asks for the copy alone. */
  readonly isCopyOnly: boolean;
  /** The folder of the uploads the copy shows, an absolute path. */
  readonly mediaDirectory: string;
}

/** Looks for the copy at the site's root; its text is read as the build needs it, not here. */
export async function loadContentCopyFiles(
  root: URL,
  contentSource: string | undefined,
): Promise<ContentCopyFiles> {
  const file = new URL(CONTENT_COPY_FILE, root);
  return {
    text: await readIfThere(file),
    isCopyOnly: isCopyOnly(contentSource),
    mediaDirectory: fileURLToPath(new URL(CONTENT_COPY_MEDIA_FOLDER, root)),
  };
}

/** `virtual:seamlet/content-copy`: the copy's text and where its uploads are. */
export function contentCopyModuleOf(files: ContentCopyFiles): string {
  return [
    `export const contentCopyText = ${JSON.stringify(files.text)};`,
    `export const isContentCopyOnly = ${JSON.stringify(files.isCopyOnly)};`,
    `export const copiedMediaDirectory = ${JSON.stringify(files.mediaDirectory)};`,
  ].join("\n");
}

async function readIfThere(file: URL): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
