// The photos of a site's own files, which its content names by an address of the site
// (`/menu/cafe/01.jpg`) and its build makes ready. The CMS's editor shows them in a photo's field:
// the site hands each one out at its address under OWN_PHOTOS_PATH.

/** Where a site hands out its own photos: `/seamlet-photos/menu/cafe/01.jpg`. */
export const OWN_PHOTOS_PATH = "/seamlet-photos";

/** The photos uploaded in the CMS live under this address; every other address is the site's own. */
const UPLOADS_PATH = "/media/";

const PARENT_SEGMENT = "..";

/** An address of the site itself that is not an upload, and that cannot climb out of the site. */
export function isOwnPhotoSrc(src: string): boolean {
  const isOnSite = src.startsWith("/") && !src.startsWith("//");
  const isUpload = src.startsWith(UPLOADS_PATH);
  const isPlainPath = !/[?#\\]/u.test(src);
  const climbsUp = src.split("/").includes(PARENT_SEGMENT);
  return isOnSite && !isUpload && isPlainPath && !climbsUp;
}

/** Where the site hands out its own photo; undefined for an upload or another site's address. */
export function ownPhotoPath(src: string): string | undefined {
  return isOwnPhotoSrc(src) ? `${OWN_PHOTOS_PATH}${src}` : undefined;
}
