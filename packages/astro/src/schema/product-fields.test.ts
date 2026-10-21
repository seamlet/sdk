import { describe, expect, expectTypeOf, it } from "vitest";
import {
  checkSiteDescription,
  collection,
  defineSchema,
  newRecord,
  parseContent,
  productFields,
  readFields,
  recordPages,
  type ContentOf,
} from ".";

const catalog = defineSchema({
  products: collection({
    label: "Товары",
    itemTitle: "name",
    item: productFields(),
  }),
});

type Product = ContentOf<typeof catalog>["products"][number];

describe("productFields", () => {
  it("is a schema the CMS reads, with a page for every product", () => {
    const sent: unknown = JSON.parse(JSON.stringify(catalog));

    expect(readFields(sent)).toEqual(catalog);
    expect(
      checkSiteDescription({
        id: "shop",
        title: "Магазин",
        schema: sent,
        initialContent: { products: [] },
        pages: [{ path: "/", title: "Главная" }],
        recordPages: [
          {
            path: "/catalog/[record]",
            collection: "products",
            searchTexts: "seo",
          },
        ],
      }).status,
    ).toBe("read");
  });

  it("starts a product empty, with nothing to fix before it is saved", () => {
    const product = newRecord(catalog.products, "p1");

    expect(parseContent(catalog, { products: [product] }).issues).toEqual([]);
    expect(product).toMatchObject({
      name: "",
      slug: "",
      photos: [],
      price: null,
      characteristics: [],
      isHidden: false,
    });
  });

  it("gives a site its characteristics as pairs of a name and a value", () => {
    expectTypeOf<Product["characteristics"][number]>().toExtend<{
      name: string;
      value: string;
    }>();
  });

  it("leaves the page of a hidden product off the site", () => {
    const pages = recordPages(catalog, {
      collection: "products",
      path: "/catalog/[record]",
      shows: (product) => !product.isHidden,
    });
    const product = { ...newRecord(catalog.products, "p1"), slug: "banya" };

    expect(pages.pathOf(product as Product)).toBe("/catalog/banya");
    expect(
      pages.pathOf({ ...product, isHidden: true } as Product),
    ).toBeUndefined();
    expect(pages.isShown?.({ ...product, isHidden: true })).toBe(false);
  });
});
