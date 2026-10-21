import { describe, expect, expectTypeOf, it } from "vitest";
import {
  collection,
  defineSchema,
  group,
  isRecordPagePath,
  recordAddressOf,
  recordAt,
  recordPageAt,
  recordPages,
  slug,
  text,
} from ".";

const schema = defineSchema({
  catalog: group({
    label: "Каталог",
    fields: {
      products: collection({
        label: "Товары",
        item: {
          name: text({ label: "Название" }),
          address: slug({ label: "Адрес страницы" }),
        },
      }),
    },
  }),
  news: collection({
    label: "Новости",
    item: { title: text({ label: "Заголовок" }) },
  }),
});

const products = schema.catalog.fields.products;

describe("recordPages", () => {
  it("gives the address of a record's page: its slug, or its id while it has none", () => {
    const pages = recordPages(schema, {
      collection: "catalog.products",
      path: "/catalog/[record]",
    });

    expect(pages.pathOf({ id: "p1", name: "Баня", address: "banya" })).toBe(
      "/catalog/banya",
    );
    expect(pages.pathOf({ id: "p2", name: "Дом", address: "" })).toBe(
      "/catalog/p2",
    );
    expect(pages.pathOf({ name: "Сауна", address: "" })).toBeUndefined();
  });

  it("takes the records of the collection it names", () => {
    const pages = recordPages(schema, {
      collection: "news",
      path: "/news/[record]",
    });

    expectTypeOf(pages.pathOf).parameter(0).toHaveProperty("title");
    // @ts-expect-error a record of the news has no price
    pages.pathOf({ title: "", price: 1 });
  });

  it("refuses a collection the schema does not have", () => {
    expect(() =>
      // @ts-expect-error the schema has no such collection
      recordPages(schema, { collection: "catalog", path: "/catalog/[record]" }),
    ).toThrow(/no collection "catalog"/u);
  });
});

describe("the address of a record's page", () => {
  it("is a slug that is an address, then the id", () => {
    expect(recordAddressOf(products, { id: "p1", address: "banya" })).toBe(
      "banya",
    );
    expect(recordAddressOf(products, { id: "p1", address: "Баня" })).toBe("p1");
    expect(recordAddressOf(schema.news, { id: "n1", title: "" })).toBe("n1");
  });

  it("is read back from a path under the pages of records", () => {
    const pages = [
      { path: "/catalog/[record]", collection: "catalog.products" },
    ];

    expect(recordPageAt(pages, "/catalog/banya")).toEqual({
      page: pages[0],
      address: "banya",
    });
    expect(recordPageAt(pages, "/catalog")).toBeUndefined();
    expect(recordPageAt(pages, "/catalog/")).toBeUndefined();
    expect(recordPageAt(pages, "/catalog/banya/photos")).toBeUndefined();
  });

  it("leads to the record whose page it is, or to the record with that id", () => {
    const records = [
      { id: "p1", address: "banya" },
      { id: "p2", address: "" },
    ];

    expect(recordAt(products, records, "banya")).toEqual({
      record: records[0],
      index: 0,
    });
    expect(recordAt(products, records, "p1")).toEqual({
      record: records[0],
      index: 0,
    });
    expect(recordAt(products, records, "p2")).toEqual({
      record: records[1],
      index: 1,
    });
    expect(recordAt(products, records, "dom")).toBeUndefined();
  });

  it("names the pages of records with a page's address, then [record]", () => {
    expect(isRecordPagePath("/catalog/[record]")).toBe(true);
    expect(isRecordPagePath("/shop/catalog/[record]")).toBe(true);
    expect(isRecordPagePath("/[record]")).toBe(false);
    expect(isRecordPagePath("/catalog/[slug]")).toBe(false);
    expect(isRecordPagePath("/catalog/[record]/photos")).toBe(false);
    expect(isRecordPagePath("/Catalog/[record]")).toBe(false);
  });
});
