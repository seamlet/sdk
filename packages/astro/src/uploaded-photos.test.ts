import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyUploadedPhotos, uploadedPhotoAddresses } from "./uploaded-photos";

const PHOTO = "/media/dzen-yoga/0123456789abcdef.webp";

describe("uploadedPhotoAddresses", () => {
  it("finds the uploaded photos a page refers to, each once, in src and srcset alike", () => {
    const html = `<img src="${PHOTO}"><img srcset="${PHOTO} 1x, /media/dzen-yoga/b_2.webp 2x"><a href="/media/dzen-yoga/b_2.webp">`;

    expect(uploadedPhotoAddresses(html)).toEqual([
      PHOTO,
      "/media/dzen-yoga/b_2.webp",
    ]);
  });

  it("leaves out what no upload can be", () => {
    const html = `<img src="/media/dzen-yoga/photo.jpg"><img src="/media/../secret.webp"><img src="/_astro/hall.webp">`;

    expect(uploadedPhotoAddresses(html)).toEqual([]);
  });
});

describe("copyUploadedPhotos", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "seamlet-build-"));
    await mkdir(join(directory, "praktiki"));
    await writeFile(join(directory, "index.html"), `<img src="${PHOTO}">`);
    await writeFile(
      join(directory, "praktiki", "index.html"),
      `<img src="${PHOTO}">`,
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  });

  it("copies every photo the pages refer to from the CMS, once", async () => {
    const fetchPhoto = vi.fn(() =>
      Promise.resolve(new Response(new Uint8Array([1, 2, 3]))),
    );
    vi.stubGlobal("fetch", fetchPhoto);

    const copied = await copyUploadedPhotos({
      directory,
      cmsOrigin: "https://cms.example",
    });

    expect(copied).toBe(1);
    expect(fetchPhoto).toHaveBeenCalledTimes(1);
    expect(fetchPhoto).toHaveBeenCalledWith(
      new URL(`https://cms.example${PHOTO}`),
    );
    expect([...(await readFile(join(directory, PHOTO)))]).toEqual([1, 2, 3]);
  });

  it("fails the build when the CMS has no such photo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );

    await expect(
      copyUploadedPhotos({ directory, cmsOrigin: "https://cms.example" }),
    ).rejects.toThrow(/failed with status 404/u);
  });
});
