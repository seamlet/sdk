import { describe, expect, it } from "vitest";
import {
  collection,
  defineSchema,
  slug,
  text,
  type SiteDescription,
} from "./schema";
import {
  checkedPagesOf,
  unmarkedTextsReport,
  type CheckedPage,
} from "./text-checks";

const schema = defineSchema({
  title: text({ label: "Заголовок" }),
  products: collection({
    label: "Товары",
    item: {
      name: text({ label: "Название" }),
      address: slug({ label: "Адрес" }),
    },
  }),
});

const description: SiteDescription = {
  id: "shop",
  title: "Магазин",
  schema,
  initialContent: {
    title: "Магазин",
    products: [
      { id: "a1", name: "Баня", address: "banya" },
      { id: "b2", name: "Беседка", address: "" },
    ],
  },
  pages: [
    { path: "/", title: "Главная" },
    { path: "/catalog", title: "Каталог" },
  ],
  recordPages: [{ path: "/catalog/[record]", collection: "products" }],
};

const home: CheckedPage = { path: "/", kind: "/" };
const catalog: CheckedPage = { path: "/catalog", kind: "/catalog" };
const banya: CheckedPage = {
  path: "/catalog/banya",
  kind: "/catalog/[record]",
};
const gazebo: CheckedPage = { path: "/catalog/b2", kind: "/catalog/[record]" };

const menuLink = { text: "Каталог", location: "header > nav > a" };

describe("checkedPagesOf", () => {
  it("lists the site's pages and the page of every record, at its slug or its id", () => {
    expect(checkedPagesOf(description)).toEqual([home, catalog, banya, gazebo]);
  });
});

describe("unmarkedTextsReport", () => {
  it("names the texts of every page once, then each kind of page with its own", () => {
    const report = unmarkedTextsReport([
      { page: home, texts: [menuLink] },
      {
        page: catalog,
        texts: [menuLink, { text: "Фильтр", location: "aside > h2" }],
      },
      {
        page: banya,
        texts: [menuLink, { text: "Ещё бани", location: "main > h2" }],
      },
      {
        page: gazebo,
        texts: [menuLink, { text: "Ещё бани", location: "main > h2" }],
      },
    ]);

    expect(report?.split("\n")).toEqual([
      "3 texts of the pages have no field, so the CMS's editor cannot edit them. Mark each with editable() of its field, or with data-cms-fixed when the code owns it:",
      "  every page:",
      "    «Каталог» in header > nav > a",
      "  /catalog:",
      "    «Фильтр» in aside > h2",
      "  /catalog/[record]:",
      "    «Ещё бани» in main > h2",
    ]);
  });

  it("reports nothing when the editor reaches every text", () => {
    expect(unmarkedTextsReport([{ page: home, texts: [] }])).toBeUndefined();
  });
});
