import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isUploadedPhoto } from "./preview-requests";

// The photos uploaded in the CMS, copied into a static build. A built page refers to them at the
// addresses its content gives (`/media/<site>/<file>.webp`), and a static host has no route to take
// them from the CMS on request, so the build puts every photo its pages refer to next to them.

/** `/media/<site>/<file>`; only the site's own photos are its uploads (see isUploadedPhoto). */
const PHOTO_ADDRESS = /\/media\/([^/\s"'<>]+)\/([^/\s"'<>?#]+)/gu;
const HTML_EXTENSION = ".html";
/** Photos copied at the same time: enough to be quick, few enough not to flood the CMS. */
const PHOTOS_COPIED_AT_ONCE = 6;
/** A build waits this long for a photo; a CMS that does not answer stops it instead of hanging it. */
const PHOTO_TIMEOUT_MS = 60_000;

/**
 * The addresses of the photos uploaded for the site that a page refers to, each once. Another
 * site's uploads are not the site's: its route of photos would not serve them either.
 */
export function uploadedPhotoAddresses(
  html: string,
  siteId: string,
): readonly string[] {
  const addresses = [...html.matchAll(PHOTO_ADDRESS)].flatMap(
    ([address, site, fileName]) =>
      site === siteId && isUploadedPhoto(fileName) ? [address] : [],
  );
  return [...new Set(addresses)];
}

/** Copies every uploaded photo the built pages in the directory refer to from the CMS. */
export async function copyUploadedPhotos(options: {
  readonly directory: string;
  readonly siteId: string;
  readonly cmsOrigin: string;
}): Promise<number> {
  const pages = await htmlFilesIn(options.directory);
  const texts = await Promise.all(pages.map((page) => readFile(page, "utf8")));
  const addresses = new Set(
    texts.flatMap((text) => uploadedPhotoAddresses(text, options.siteId)),
  );

  await inTurns([...addresses], PHOTOS_COPIED_AT_ONCE, (address) =>
    copyPhoto(address, options.directory, options.cmsOrigin),
  );
  return addresses.size;
}

async function copyPhoto(
  address: string,
  directory: string,
  cmsOrigin: string,
): Promise<void> {
  const url = new URL(address, cmsOrigin);
  const response = await fetchPhoto(url);
  if (!response.ok) {
    throw new Error(
      `Copying the photo ${url.href} into the build failed with status ${String(response.status)}`,
    );
  }

  const target = join(directory, address);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
}

async function fetchPhoto(url: URL): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(
      `Copying the photo ${url.href} into the build failed: the CMS did not answer`,
      { cause: error },
    );
  }
}

/** Runs the task for every item, at most `limit` at a time. */
async function inTurns<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const waiting = [...items];
  const runInTurn = async () => {
    for (
      let item = waiting.shift();
      item !== undefined;
      item = waiting.shift()
    ) {
      await task(item);
    }
  };
  const runners = Array.from(
    { length: Math.min(limit, waiting.length) },
    runInTurn,
  );
  await Promise.all(runners);
}

async function htmlFilesIn(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(HTML_EXTENSION))
    .map((entry) => join(entry.parentPath, entry.name));
}
