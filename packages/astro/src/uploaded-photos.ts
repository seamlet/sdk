import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { copiedMediaFile } from "./copied-media";
import { isUploadedFile } from "./preview-requests";
import { UPLOADS_PATH } from "./site-addresses";

// The photos and documents uploaded in the CMS, copied into a static build. A built page refers to
// them at the addresses its content gives (`/media/<site>/<file>.webp`, `.pdf`), and a static host
// has no route to take them from the CMS on request, so the build puts every upload its pages refer
// to next to them. A photo the CMS does not give is taken from the copy kept in the site's own
// repository, and a site that has left the CMS takes all of them from there.

/** `/media/<site>/<file>`; only the site's own uploads (see isUploadedFile). */
const PHOTO_ADDRESS = new RegExp(
  `${UPLOADS_PATH}/([^/\\s"'<>]+)/([^/\\s"'<>?#]+)`,
  "gu",
);
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
      site === siteId && isUploadedFile(fileName) ? [address] : [],
  );
  return [...new Set(addresses)];
}

export interface PhotoCopying {
  readonly directory: string;
  readonly siteId: string;
  /** Where the CMS is; undefined for a site that never asks it, so its copy gives every photo. */
  readonly cmsOrigin: string | undefined;
  /** The folder of the uploads the CMS committed to the site's repository. */
  readonly copiedMediaDirectory: string;
}

/**
 * Copies every uploaded photo the built pages in the directory refer to into it: from the CMS, or
 * from the copy of the site's uploads where the CMS does not give one.
 */
export async function copyUploadedPhotos(
  options: PhotoCopying,
): Promise<number> {
  const pages = await htmlFilesIn(options.directory);
  const texts = await Promise.all(pages.map((page) => readFile(page, "utf8")));
  const addresses = new Set(
    texts.flatMap((text) => uploadedPhotoAddresses(text, options.siteId)),
  );

  await inTurns([...addresses], PHOTOS_COPIED_AT_ONCE, (address) =>
    copyPhoto(address, options),
  );
  return addresses.size;
}

async function copyPhoto(
  address: string,
  options: PhotoCopying,
): Promise<void> {
  const bytes = await photoBytes(address, options);
  const target = join(options.directory, address);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

async function photoBytes(
  address: string,
  options: PhotoCopying,
): Promise<Uint8Array<ArrayBuffer>> {
  const copied = () =>
    copiedMediaFile(options.copiedMediaDirectory, basename(address));
  if (options.cmsOrigin === undefined) {
    const file = await copied();
    if (file !== undefined) return file;
    throw new Error(
      `Copying the photo ${address} into the build failed: it is not in ${options.copiedMediaDirectory}`,
    );
  }

  const fromCms = await photoFromCms(new URL(address, options.cmsOrigin));
  if (fromCms.status === "taken") return fromCms.bytes;
  const file = await copied();
  if (file !== undefined) return file;
  throw fromCms.problem;
}

type PhotoFromCms =
  | { readonly status: "taken"; readonly bytes: Uint8Array<ArrayBuffer> }
  | { readonly status: "failed"; readonly problem: Error };

async function photoFromCms(url: URL): Promise<PhotoFromCms> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS),
    });
  } catch (error) {
    const problem = new Error(
      `Copying the photo ${url.href} into the build failed: the CMS did not answer`,
      { cause: error },
    );
    return { status: "failed", problem };
  }
  if (!response.ok) {
    const problem = new Error(
      `Copying the photo ${url.href} into the build failed with status ${String(response.status)}`,
    );
    return { status: "failed", problem };
  }
  return {
    status: "taken",
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
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
