import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isUploadedFile } from "./preview-requests";

// The uploads the CMS committed beside the content copy (`seamlet/media/<file>`), the files a site
// shows when the CMS cannot give them. Only names the CMS writes are read, so nothing outside the
// folder is.

const PDF_EXTENSION = ".pdf";
const PDF_CONTENT_TYPE = "application/pdf";
const PHOTO_CONTENT_TYPE = "image/webp";

/** The bytes of the upload of that name in the folder of copied uploads, or undefined when it has none. */
export async function copiedMediaFile(
  directory: string,
  fileName: string,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (!isUploadedFile(fileName)) return undefined;

  return readIfThere(join(directory, fileName));
}

/** What an upload is, by its name: the CMS names a photo `.webp` and a document `.pdf`. */
function uploadContentTypeOf(fileName: string): string {
  return fileName.endsWith(PDF_EXTENSION)
    ? PDF_CONTENT_TYPE
    : PHOTO_CONTENT_TYPE;
}

/**
 * The headers an upload is handed out with on the site's origin, whoever gave its bytes: the type
 * its name says and no other a browser could guess from the bytes, and a document saved, never
 * shown, as the CMS hands it out. Whatever the answer of the CMS says, the site's origin never
 * shows a page.
 */
export function uploadHeadersOf(fileName: string): Headers {
  const contentType = uploadContentTypeOf(fileName);
  const headers = new Headers({
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
  if (contentType === PDF_CONTENT_TYPE) {
    headers.set("Content-Disposition", "attachment");
  }
  return headers;
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
