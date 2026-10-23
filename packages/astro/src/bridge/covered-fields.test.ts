import { describe, expect, it } from "vitest";
import { coveredFieldsOf, isShownIn, type PlacedField } from "./covered-fields";
import type { Point } from "./messages";

const viewport = { width: 1000, height: 800 };

/** A card whose stretched link of its name lies over the whole card, at x 100–300. */
const name: PlacedField = {
  path: "products.0.name",
  box: { left: 100, top: 300, width: 200, height: 30 },
};
const price: PlacedField = {
  path: "products.0.price",
  box: { left: 100, top: 340, width: 80, height: 20 },
};

function isInBox(field: PlacedField, point: Point): boolean {
  const { left, top, width, height } = field.box;
  const isAcross = point.x >= left && point.x <= left + width;
  const isDown = point.y >= top && point.y <= top + height;
  return isAcross && isDown;
}

describe("coveredFieldsOf", () => {
  it("names a field every click on which lands on another, and what lies over it", () => {
    const covered = coveredFieldsOf([name, price], {
      viewport,
      isFieldAt: (field, point) => field === name && isInBox(field, point),
      whatIsAt: () => "the field products.0.name (a.card-link)",
    });

    expect(covered).toEqual([
      {
        path: "products.0.price",
        coveredBy: "the field products.0.name (a.card-link)",
      },
    ]);
  });

  it("takes a field a click reaches at a point other than its middle", () => {
    const tried: Point[] = [];
    const covered = coveredFieldsOf([price], {
      viewport,
      isFieldAt: (_field, point) => {
        tried.push(point);
        return tried.length === 3;
      },
      whatIsAt: () => "div.badge",
    });

    expect(covered).toEqual([]);
    expect(tried[0]).toEqual({ x: 140, y: 350 });
  });

  it("tries only the part of a field on screen, and leaves a field out of it", () => {
    const below = {
      path: "footer.note",
      box: { left: 0, top: 900, width: 100, height: 20 },
    };
    const halfShown = {
      path: "hero.photo",
      box: { left: -500, top: 0, width: 1000, height: 100 },
    };
    const tried: Point[] = [];
    coveredFieldsOf([below, halfShown], {
      viewport,
      isFieldAt: (_field, point) => {
        tried.push(point);
        return true;
      },
      whatIsAt: () => "nothing",
    });

    expect(tried).toEqual([{ x: 250, y: 50 }]);
  });
});

describe("isShownIn", () => {
  it("tells a box with a part on screen from one wholly off it", () => {
    expect(isShownIn(name.box, viewport)).toBe(true);
    expect(
      isShownIn({ left: 0, top: -50, width: 10, height: 50 }, viewport),
    ).toBe(false);
  });
});
