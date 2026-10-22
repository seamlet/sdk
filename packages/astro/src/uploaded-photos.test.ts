import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyUploadedPhotos, uploadedPhotoAddresses } from "./uploaded-photos";

const PHOTO = "/media/my-site/0123456789abcdef.webp";

describe("uploadedPhotoAddresses", () => {
  it("finds the uploaded photos a page refers to, each once, in src and srcset alike", () => {
    const html = `<img src="${PHOTO}"><img srcset="${PHOTO} 1x, /media/my-site/b_2.webp 2x"><a href="/media/my-site/b_2.webp">`;

    expect(uploadedPhotoAddresses(html, "my-site")).toEqual([
      PHOTO,
      "/media/my-site/b_2.webp",
    ]);
  });

  it("finds the uploaded documents a page links to", () => {
    const html = `<a href="/media/my-site/0123456789abcdef.pdf" download>Прайс</a>`;

    expect(uploadedPhotoAddresses(html, "my-site")).toEqual([
      "/media/my-site/0123456789abcdef.pdf",
    ]);
  });

  it("leaves out what no upload can be", () => {
    const html = `<img src="/media/my-site/photo.jpg"><img src="/media/../secret.webp"><img src="/_astro/hall.webp">`;

    expect(uploadedPhotoAddresses(html, "my-site")).toEqual([]);
  });

  it("leaves out the uploads of another site", () => {
    const html = `<img src="/media/other-site/0123456789abcdef.webp">`;

    expect(uploadedPhotoAddresses(html, "my-site")).toEqual([]);
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
      siteId: "my-site",
      cmsOrigin: "https://cms.example",
    });

    expect(copied).toBe(1);
    expect(fetchPhoto).toHaveBeenCalledTimes(1);
    expect(fetchPhoto).toHaveBeenCalledWith(
      new URL(`https://cms.example${PHOTO}`),
      expect.anything(),
    );
    expect([...(await readFile(join(directory, PHOTO)))]).toEqual([1, 2, 3]);
  });

  it("fails the build when the CMS has no such photo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );

    await expect(
      copyUploadedPhotos({
        directory,
        siteId: "my-site",
        cmsOrigin: "https://cms.example",
      }),
    ).rejects.toThrow(/failed with status 404/u);
  });

  it("copies a few photos at a time", async () => {
    const pages = Array.from(
      { length: 10 },
      (_, index) => `<img src="/media/my-site/photo-${String(index)}.webp">`,
    );
    await writeFile(join(directory, "index.html"), pages.join(""));
    let running = 0;
    let mostRunning = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        running += 1;
        mostRunning = Math.max(mostRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
        return new Response(new Uint8Array([1]));
      }),
    );

    const copied = await copyUploadedPhotos({
      directory,
      siteId: "my-site",
      cmsOrigin: "https://cms.example",
    });

    expect(copied).toBe(11);
    expect(mostRunning).toBeGreaterThan(1);
    expect(mostRunning).toBeLessThanOrEqual(6);
  });

  it("fails the build, naming the photo, when the CMS does not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("fetch failed"))),
    );

    await expect(
      copyUploadedPhotos({
        directory,
        siteId: "my-site",
        cmsOrigin: "https://cms.example",
      }),
    ).rejects.toThrow(
      `Copying the photo https://cms.example${PHOTO} into the build failed: the CMS did not answer`,
    );
  });
});
