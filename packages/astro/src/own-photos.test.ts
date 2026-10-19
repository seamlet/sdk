import { describe, expect, it } from "vitest";
import { isOwnPhotoSrc, ownPhotoPath } from "./own-photos";

describe("own photos of a site", () => {
  it("hands out a photo of the site's own files under its path", () => {
    expect(ownPhotoPath("/menu/cafe/01.jpg")).toBe(
      "/seamlet-photos/menu/cafe/01.jpg",
    );
  });

  it("leaves uploads, other sites and addresses that climb out alone", () => {
    expect(ownPhotoPath("/media/cafe/abc.webp")).toBeUndefined();
    expect(ownPhotoPath("https://example.com/a.jpg")).toBeUndefined();
    expect(ownPhotoPath("//example.com/a.jpg")).toBeUndefined();
    expect(isOwnPhotoSrc("/menu/../secret")).toBe(false);
    expect(isOwnPhotoSrc("/menu/a.jpg?x=1")).toBe(false);
  });
});
