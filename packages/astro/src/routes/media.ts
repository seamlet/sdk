import type { APIRoute } from "astro";
import { cmsOrigin } from "virtual:seamlet/config";
import {
  copiedMediaDirectory,
  isContentCopyOnly,
} from "virtual:seamlet/content-copy";
import site from "virtual:seamlet/site";
import {
  copiedMediaFile,
  PDF_CONTENT_TYPE,
  type CopiedMediaFile,
} from "../copied-media";
import { isUploadedFile } from "../preview-requests";
import { uploadedPhotoPath } from "../site-addresses";

// The photos and documents uploaded in the CMS, at the addresses the content gives them (`/media/<site>/…`).
// A static build of the site copies them; the preview and the pages rendered on request take them
// from the CMS here, or from the copy in the site's repository when the CMS does not give them
// (always, for a site that has left the CMS).

const NOT_FOUND = 404;
/** The CMS did not answer, or answered with an error of its own. */
const BAD_GATEWAY = 502;
/** A page waits this long for a photo; a CMS that does not answer gets the page no hung request. */
const PHOTO_TIMEOUT_MS = 10_000;
/** An upload's name is the hash of its bytes, so the file under it never changes. */
const COPIED_FILE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const GET: APIRoute = async ({ params }) => {
  const fileName = params["file"];
  const isOurs = params["site"] === site.id && isUploadedFile(fileName);
  if (!isOurs) {
    return new Response(null, { status: NOT_FOUND });
  }

  const url = new URL(uploadedPhotoPath(site.id, fileName), cmsOrigin);
  const response = isContentCopyOnly ? undefined : await photoFromCms(url);
  if (response?.ok === true) {
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "image/webp",
        "Cache-Control": response.headers.get("Cache-Control") ?? "no-cache",
      },
    });
  }

  const copied = await copiedMediaFile(copiedMediaDirectory, fileName);
  if (copied !== undefined) return copiedResponse(copied);
  return new Response(null, { status: failureStatusOf(response) });
};

function copiedResponse(file: CopiedMediaFile): Response {
  const headers = new Headers({
    "Content-Type": file.contentType,
    "Cache-Control": COPIED_FILE_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
  });
  // A document is saved, never shown on the site's origin, as the CMS hands it out.
  if (file.contentType === PDF_CONTENT_TYPE) {
    headers.set("Content-Disposition", "attachment");
  }
  return new Response(file.bytes, { headers });
}

/** What a photo nobody has gets: nothing for a site that asks no CMS, else the CMS's failure. */
function failureStatusOf(response: Response | undefined): number {
  if (isContentCopyOnly) return NOT_FOUND;
  if (response === undefined) return BAD_GATEWAY;
  return response.status === NOT_FOUND ? NOT_FOUND : BAD_GATEWAY;
}

/** The CMS's answer for the photo, or undefined when the CMS did not answer in time. */
async function photoFromCms(url: URL): Promise<Response | undefined> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
  } catch (error) {
    console.warn(
      `@seamlet/astro: the photo ${url.href} could not be taken from the CMS`,
      error,
    );
    return undefined;
  }
}
