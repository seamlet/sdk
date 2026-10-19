import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { GET } from "./own-photos";

vi.mock("virtual:seamlet/site", () => ({
  default: {
    ownPhotoAt: (src: string) =>
      src === "/menu/01.jpg" ? { src: "/_astro/01.hash.webp" } : undefined,
  },
}));

function requestPhoto(path: string): Response {
  const context = {
    params: { path },
    redirect: (location: string, status: number) =>
      new Response(null, { status, headers: { Location: location } }),
  } as unknown as APIContext;
  return GET(context) as Response;
}

describe("the route of the site's own photos", () => {
  it("leads to the build's file of a photo the site has", () => {
    const response = requestPhoto("menu/01.jpg");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/_astro/01.hash.webp");
  });

  it("finds nothing that is not an own photo of the site", () => {
    const paths = [
      "menu/../../secret.jpg",
      "media/coffee-shop/0123.webp",
      "menu/01.jpg?size=big",
      "menu/02.jpg",
      "",
    ];

    for (const path of paths) expect(requestPhoto(path).status).toBe(404);
  });
});
