import { describe, expect, it } from "vitest";
import { pickedPathAt, rankedMarkersAt } from "./marker-picks";

const card = { top: 0, left: 0, width: 300, height: 400 };
const photo = { top: 0, left: 0, width: 300, height: 200 };
const price = { top: 300, left: 20, width: 80, height: 30 };
const header = { top: 0, left: 0, width: 1280, height: 80 };

/** A card whose name is a link stretched over the whole card, as many catalogs make it. */
const markers = [
  { path: "menu.0", box: card },
  { path: "menu.0.name", box: card },
  { path: "menu.0.photo", box: photo },
  { path: "menu.0.price", box: price },
];

describe("pickedPathAt", () => {
  it("chooses the smallest marked element at the point, not the one on top", () => {
    expect(
      pickedPathAt(markers, { path: "menu.0.name", point: { x: 50, y: 310 } }),
    ).toBe("menu.0.price");
    expect(
      pickedPathAt(markers, { path: "menu.0.name", point: { x: 50, y: 50 } }),
    ).toBe("menu.0.photo");
  });

  it("chooses the deeper path of boxes as large: the name over its record", () => {
    expect(
      pickedPathAt(markers, { path: "menu.0", point: { x: 250, y: 250 } }),
    ).toBe("menu.0.name");
  });

  it("keeps to the block the click landed in, so a sticky header keeps its click", () => {
    const scrolled = [{ path: "brand.name", box: header }, ...markers];

    expect(
      pickedPathAt(scrolled, { path: "brand.name", point: { x: 50, y: 50 } }),
    ).toBe("brand.name");
  });

  it("gives the element the page named when no box holds the point", () => {
    expect(
      pickedPathAt([], { path: "menu.0.name", point: { x: 50, y: 50 } }),
    ).toBe("menu.0.name");
  });
});

describe("rankedMarkersAt", () => {
  it("lists every marked element at the point, the chosen one first", () => {
    const ranked = rankedMarkersAt(markers, {
      path: "menu.0.name",
      point: { x: 50, y: 310 },
    });

    expect(ranked.map((marker) => marker.path)).toEqual([
      "menu.0.price",
      "menu.0.name",
      "menu.0",
    ]);
  });
});
