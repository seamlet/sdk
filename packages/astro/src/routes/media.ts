import type { APIRoute } from "astro";
import { cmsOrigin } from "virtual:seamlet/config";
import site from "virtual:seamlet/site";
import { isUploadedFile } from "../preview-requests";
import { uploadedPhotoPath } from "../site-addresses";

// The photos and documents uploaded in the CMS, at the addresses the content gives them (`/media/<site>/…`).
// A static build of the site copies them; the preview and the pages rendered on request take them
// from the CMS here.

const NOT_FOUND = 404;
/** The CMS did not answer, or answered with an error of its own. */
const BAD_GATEWAY = 502;
/** A page waits this long for a photo; a CMS that does not answer gets the page no hung request. */
const PHOTO_TIMEOUT_MS = 10_000;

export const GET: APIRoute = async ({ params }) => {
  const fileName = params["file"];
  const isOurs = params["site"] === site.id && isUploadedFile(fileName);
  if (!isOurs) {
    return new Response(null, { status: NOT_FOUND });
  }

  const url = new URL(uploadedPhotoPath(site.id, fileName), cmsOrigin);
  const response = await photoFromCms(url);
  if (response === undefined) {
    return new Response(null, { status: BAD_GATEWAY });
  }
  if (!response.ok) {
    const status = response.status === NOT_FOUND ? NOT_FOUND : BAD_GATEWAY;
    return new Response(null, { status });
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": response.headers.get("Cache-Control") ?? "no-cache",
    },
  });
};

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
