import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isUploadedFile } from "./preview-requests";

// The uploads the CMS committed beside the content copy (`seamlet/media/<file>`), the files a site
// shows when the CMS cannot give them. Only names the CMS writes are read, so nothing outside the
// folder is.

const PDF_EXTENSION = ".pdf";
export const PDF_CONTENT_TYPE = "application/pdf";
const PHOTO_CONTENT_TYPE = "image/webp";

export interface CopiedMediaFile {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

/** The upload of that name in the folder of copied uploads, or undefined when it has none. */
export async function copiedMediaFile(
  directory: string,
  fileName: string,
): Promise<CopiedMediaFile | undefined> {
  if (!isUploadedFile(fileName)) return undefined;

  const bytes = await readIfThere(join(directory, fileName));
  if (bytes === undefined) return undefined;
  const isPdf = fileName.endsWith(PDF_EXTENSION);
  return {
    bytes,
    contentType: isPdf ? PDF_CONTENT_TYPE : PHOTO_CONTENT_TYPE,
  };
}

async function readIfThere(
  file: string,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
