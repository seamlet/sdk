import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { GET } from "./media";

const copy = vi.hoisted(() => ({
  isContentCopyOnly: false,
  copiedMediaDirectory: "",
}));

vi.mock("virtual:seamlet/content-copy", () => copy);
vi.mock("virtual:seamlet/config", () => ({
  siteId: "coffee-shop",
  siteTitle: "Моя кофейня",
  cmsOrigin: "https://cms.example",
  ownerToken: undefined,
}));
vi.mock("virtual:seamlet/site", () => ({ default: { id: "coffee-shop" } }));

const PHOTO = "0123456789abcdef.webp";

function requestPhoto(site: string, file: string): Promise<Response> {
  const context = { params: { site, file } } as unknown as APIContext;
  return Promise.resolve(GET(context));
}

beforeEach(async () => {
  copy.isContentCopyOnly = false;
  copy.copiedMediaDirectory = await mkdtemp(join(tmpdir(), "seamlet-media-"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(copy.copiedMediaDirectory, { recursive: true, force: true });
});

describe("the route of the uploaded photos", () => {
  it("takes the site's own photo from the CMS", async () => {
    const fetchPhoto = vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2]), {
          headers: { "Content-Type": "image/webp" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchPhoto);

    const response = await requestPhoto("coffee-shop", PHOTO);

    expect(response.status).toBe(200);
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2]);
    expect(fetchPhoto).toHaveBeenCalledWith(
      new URL(`https://cms.example/media/coffee-shop/${PHOTO}`),
      expect.anything(),
    );
  });

  it("finds no photo of another site or by a name no upload has", async () => {
    const fetchPhoto = vi.fn();
    vi.stubGlobal("fetch", fetchPhoto);

    expect((await requestPhoto("my-site", PHOTO)).status).toBe(404);
    expect((await requestPhoto("coffee-shop", "../secret.webp")).status).toBe(
      404,
    );
    expect((await requestPhoto("coffee-shop", "photo.jpg")).status).toBe(404);
    expect(fetchPhoto).not.toHaveBeenCalled();
  });

  it("answers 502 when the CMS does not answer or fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(new DOMException("timed out", "TimeoutError")),
      ),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await requestPhoto("coffee-shop", PHOTO)).status).toBe(502);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("error", { status: 500 }))),
    );
    expect((await requestPhoto("coffee-shop", PHOTO)).status).toBe(502);
  });

  it("hands out the CMS's photo as a photo whatever type the answer says", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<script>alert(1)</script>", {
            headers: { "Content-Type": "text/html" },
          }),
        ),
      ),
    );

    const response = await requestPhoto("coffee-shop", PHOTO);

    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("hands the CMS's document out to be saved, never shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("%PDF-1.4", {
            headers: { "Content-Type": "application/pdf" },
          }),
        ),
      ),
    );

    const response = await requestPhoto("coffee-shop", "price.pdf");

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe("attachment");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("passes on that the CMS has no such photo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );

    expect((await requestPhoto("coffee-shop", PHOTO)).status).toBe(404);
  });
});

describe("the route of the uploaded photos with the copy in the repository", () => {
  const keepPhoto = (fileName: string) =>
    writeFile(
      join(copy.copiedMediaDirectory, fileName),
      new Uint8Array([4, 5]),
    );

  it("serves the copied file when the CMS does not answer", async () => {
    await keepPhoto(PHOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("fetch failed"))),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await requestPhoto("coffee-shop", PHOTO);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([4, 5]);
  });

  it("serves the copied file when the CMS fails", async () => {
    await keepPhoto(PHOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("error", { status: 500 }))),
    );

    expect((await requestPhoto("coffee-shop", PHOTO)).status).toBe(200);
  });

  it("hands a copied document out to be saved, never shown", async () => {
    await keepPhoto("price.pdf");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
    );

    const response = await requestPhoto("coffee-shop", "price.pdf");

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe("attachment");
  });

  it("prefers the CMS's photo while it answers", async () => {
    await keepPhoto(PHOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(new Uint8Array([1])))),
    );

    const response = await requestPhoto("coffee-shop", PHOTO);

    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1]);
  });

  it("still answers 502 for a photo the copy lacks when the CMS fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("error", { status: 500 }))),
    );

    expect((await requestPhoto("coffee-shop", PHOTO)).status).toBe(502);
  });

  it("serves a site that left the CMS from the copy alone", async () => {
    copy.isContentCopyOnly = true;
    await keepPhoto(PHOTO);
    const fetchPhoto = vi.fn();
    vi.stubGlobal("fetch", fetchPhoto);

    expect((await requestPhoto("coffee-shop", PHOTO)).status).toBe(200);
    expect(
      (await requestPhoto("coffee-shop", "ffffffffffffffff.webp")).status,
    ).toBe(404);
    expect(fetchPhoto).not.toHaveBeenCalled();
  });

  it("reads nothing outside the folder of the copy", async () => {
    copy.isContentCopyOnly = true;

    expect((await requestPhoto("coffee-shop", "../secret.webp")).status).toBe(
      404,
    );
  });
});
