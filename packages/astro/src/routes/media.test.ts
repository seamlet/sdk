import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { GET } from "./media";

vi.mock("virtual:seamlet/config", () => ({
  siteId: "coffee-shop",
  siteTitle: "Кофейня «Зерно»",
  cmsOrigin: "https://cms.example",
}));
vi.mock("virtual:seamlet/site", () => ({ default: { id: "coffee-shop" } }));

const PHOTO = "0123456789abcdef.webp";

function requestPhoto(site: string, file: string): Promise<Response> {
  const context = { params: { site, file } } as unknown as APIContext;
  return Promise.resolve(GET(context));
}

afterEach(() => {
  vi.unstubAllGlobals();
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

    expect((await requestPhoto("dzen-yoga", PHOTO)).status).toBe(404);
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

  it("passes on that the CMS has no such photo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );

    expect((await requestPhoto("coffee-shop", PHOTO)).status).toBe(404);
  });
});
