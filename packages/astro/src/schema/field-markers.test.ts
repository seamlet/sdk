import { describe, expect, it } from "vitest";
import {
  collection,
  defineSchema,
  editable,
  group,
  image,
  link,
  number,
  resolveFieldPath,
  text,
  type ContentOf,
} from "./index";

const schema = defineSchema({
  hero: group({
    label: "Hero",
    fields: {
      title: text({ label: "Title" }),
      photo: image({ label: "Photo" }),
      booking: link({ label: "Booking" }),
    },
  }),
  menu: collection({
    label: "Menu",
    item: { name: text({ label: "Name" }), price: number({ label: "Price" }) },
  }),
});

const edit = editable<ContentOf<typeof schema>>();

describe("editable", () => {
  it("marks an element with the path of its field or record", () => {
    expect(edit("hero", "title")).toEqual({ "data-cms-path": "hero.title" });
    expect(edit("menu", 2)).toEqual({ "data-cms-path": "menu.2" });
    expect(edit("menu", 2, "price")).toEqual({
      "data-cms-path": "menu.2.price",
    });
  });

  it("does not compile for a path the content does not have", () => {
    // @ts-expect-error: the hero has no subtitle
    edit("hero", "subtitle");
    // @ts-expect-error: an image is one field, its address is not a field of its own
    edit("hero", "photo", "src");
    // @ts-expect-error: so is a link
    edit("hero", "booking", "href");
    // @ts-expect-error: a record of a collection is addressed by its index
    edit("menu", "price");
  });
});

describe("resolveFieldPath", () => {
  it("finds fields, fields inside groups and records, and records", () => {
    expect(resolveFieldPath(schema, "hero")).toMatchObject({
      kind: "field",
      path: ["hero"],
    });
    expect(resolveFieldPath(schema, "hero.title")).toMatchObject({
      kind: "field",
      path: ["hero", "title"],
      field: { kind: "text", label: "Title" },
    });
    expect(resolveFieldPath(schema, "menu.2")).toMatchObject({
      kind: "record",
      path: ["menu", 2],
      collection: { label: "Menu" },
      index: 2,
    });
    expect(resolveFieldPath(schema, "menu.2.price")).toMatchObject({
      kind: "field",
      path: ["menu", 2, "price"],
      field: { kind: "number" },
    });
  });

  it("gives undefined for a path the schema does not have", () => {
    const unknownPaths = [
      "",
      "footer",
      "hero.subtitle",
      "hero.title.x",
      "menu.x",
      "menu.-1",
      "menu.2.x",
    ];

    for (const path of unknownPaths) {
      expect(resolveFieldPath(schema, path)).toBeUndefined();
    }
  });

  it("does not take inherited keys for fields", () => {
    expect(resolveFieldPath(schema, "constructor")).toBeUndefined();
  });
});
