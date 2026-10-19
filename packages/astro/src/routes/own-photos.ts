import type { APIRoute } from "astro";
import site from "virtual:seamlet/site";
import { isOwnPhotoSrc } from "../own-photos";

// The site's own photos for the CMS's editor, at the address its content gives them: the build's
// file of the photo, which the site serves already.

const NOT_FOUND = 404;
const FOUND = 302;

export const GET: APIRoute = ({ params, redirect }) => {
  const src = `/${params["path"] ?? ""}`;
  const photo = isOwnPhotoSrc(src) ? site.ownPhotoAt(src) : undefined;
  if (photo === undefined) {
    return new Response(null, { status: NOT_FOUND });
  }

  return redirect(photo.src, FOUND);
};
