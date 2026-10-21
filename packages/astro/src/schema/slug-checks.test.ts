import { describe, expect, it } from "vitest";
import { collection, defineSchema, group, parseContent, slug, text } from ".";
import { MAX_SLUG_LENGTH } from "./slugs";

const schema = defineSchema({
  shop: group({
    label: "Магазин",
    fields: {
      products: collection({
        label: "Товары",
        item: {
          name: text({ label: "Название" }),
          address: slug({ label: "Адрес страницы" }),
          variants: collection({
            label: "Варианты",
            item: {
              name: text({ label: "Название" }),
              address: slug({ label: "Адрес" }),
            },
          }),
        },
      }),
    },
  }),
});

function contentWith(products: readonly object[]) {
  return { shop: { products } };
}

describe("parseContent of slugs", () => {
  it("keeps a slug that is no address with an issue, as a person typed it", () => {
    const parsed = parseContent(
      schema,
      contentWith([
        { id: "a", name: "Баня", address: "Баня", variants: [] },
        { id: "b", name: "Дом", address: "d".repeat(MAX_SLUG_LENGTH + 1) },
      ]),
    );

    expect(parsed.content.shop.products[0]?.address).toBe("Баня");
    expect(parsed.issues).toEqual([
      { path: ["shop", "products", 0, "address"], code: "invalid-slug" },
      {
        path: ["shop", "products", 1, "address"],
        code: "too-long",
        maxLength: MAX_SLUG_LENGTH,
      },
    ]);
  });

  it("finds a slug another record of the collection has as its slug or its id", () => {
    const parsed = parseContent(
      schema,
      contentWith([
        { id: "a", name: "Баня", address: "banya" },
        { id: "b", name: "Баня 2", address: "banya" },
        { id: "c", name: "Дом", address: "a" },
        { id: "dom", name: "Дом 2", address: "" },
        { id: "e", name: "Сауна", address: "e" },
      ]),
    );

    expect(parsed.issues).toEqual([
      { path: ["shop", "products", 1, "address"], code: "taken-slug" },
      { path: ["shop", "products", 2, "address"], code: "taken-slug" },
    ]);
  });

  it("checks the slugs of a collection inside a record by that collection", () => {
    const parsed = parseContent(
      schema,
      contentWith([
        {
          id: "a",
          name: "Баня",
          address: "banya",
          variants: [
            { id: "v1", name: "6×4", address: "banya" },
            { id: "v2", name: "6×6", address: "banya" },
          ],
        },
      ]),
    );

    expect(parsed.issues).toEqual([
      {
        path: ["shop", "products", 0, "variants", 1, "address"],
        code: "taken-slug",
      },
    ]);
  });
});
