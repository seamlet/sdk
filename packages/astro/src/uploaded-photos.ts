import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isUploadedPhoto } from "./preview-requests";

// The photos uploaded in the CMS, copied into a static build. A built page refers to them at the
// addresses its content gives (`/media/<site>/<file>.webp`), and a static host has no route to take
// them from the CMS on request, so the build puts every photo its pages refer to next to them.

/** `/media/<site>/<file>`: the site's id is the part a CMS gives sites, lowercase with dashes. */
const PHOTO_ADDRESS = /\/media\/([a-z0-9-]+)\/([A-Za-z0-9_-]+\.webp)/gu;
const HTML_EXTENSION = ".html";

/** The addresses of the uploaded photos a page refers to, each once. */
export function uploadedPhotoAddresses(html: string): readonly string[] {
  const addresses = [...html.matchAll(PHOTO_ADDRESS)].flatMap(
    ([address, , fileName]) => (isUploadedPhoto(fileName) ? [address] : []),
  );
  return [...new Set(addresses)];
}

/** Copies every uploaded photo the built pages in the directory refer to from the CMS. */
export async function copyUploadedPhotos(options: {
  readonly directory: string;
  readonly cmsOrigin: string;
}): Promise<number> {
  const pages = await htmlFilesIn(options.directory);
  const texts = await Promise.all(pages.map((page) => readFile(page, "utf8")));
  const addresses = new Set(texts.flatMap(uploadedPhotoAddresses));

  await Promise.all(
    [...addresses].map((address) =>
      copyPhoto(address, options.directory, options.cmsOrigin),
    ),
  );
  return addresses.size;
}

async function copyPhoto(
  address: string,
  directory: string,
  cmsOrigin: string,
): Promise<void> {
  const url = new URL(address, cmsOrigin);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Copying the photo ${url.href} into the build failed with status ${String(response.status)}`,
    );
  }

  const target = join(directory, address);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
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
