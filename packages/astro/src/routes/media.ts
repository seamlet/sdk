import type { APIRoute } from "astro";
import { cmsOrigin } from "virtual:seamlet/config";
import site from "virtual:seamlet/site";
import { isUploadedPhoto } from "../preview-requests";

// The photos uploaded in the CMS, at the addresses the content gives them (`/media/<site>/…`).
// A static build of the site copies them; the preview and the pages rendered on request take them
// from the CMS here.

const NOT_FOUND = 404;

export const GET: APIRoute = async ({ params }) => {
  const fileName = params["file"];
  const isOurs = params["site"] === site.id && isUploadedPhoto(fileName);
  if (!isOurs) {
    return new Response(null, { status: NOT_FOUND });
  }

  const response = await fetch(
    new URL(`/media/${site.id}/${fileName}`, cmsOrigin),
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": response.headers.get("Cache-Control") ?? "no-cache",
    },
  });
};
