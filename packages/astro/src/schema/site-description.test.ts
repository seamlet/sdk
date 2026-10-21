import { describe, expect, it } from "vitest";
import { collection, defineSchema, group, slug, text } from ".";
import { requestForm, requestPhone, requestText } from "./request-forms";
import { checkSiteDescription, readSiteDescription } from "./site-description";

const schema = defineSchema({
  title: text({ label: "Заголовок" }),
  seo: group({
    label: "Поиск",
    fields: {
      home: group({
        label: "Главная",
        fields: {
          title: text({ label: "Заголовок" }),
          description: text({ label: "Описание" }),
        },
      }),
    },
  }),
});

const description = {
  id: "coffee-shop",
  title: "Кофейня «Зерно»",
  schema,
  initialContent: {
    title: "Зерно",
    seo: { home: { title: "", description: "" } },
  },
  pages: [
    { path: "/", title: "Главная", searchTexts: "seo.home" },
    { path: "/menu", title: "Меню" },
  ],
};

describe("readSiteDescription", () => {
  it("reads what a site tells about itself, through JSON", () => {
    const json: unknown = JSON.parse(JSON.stringify(description));

    expect(readSiteDescription(json)).toEqual(description);
  });

  it("refuses a description that is not whole and sound", () => {
    const broken = [
      { ...description, id: "Coffee Shop" },
      { ...description, title: " " },
      { ...description, schema: { title: { kind: "video", label: "Видео" } } },
      { ...description, initialContent: { title: 3 } },
      { ...description, pages: [] },
      { ...description, pages: [{ path: "/menu", title: "Меню" }] },
      {
        ...description,
        pages: [
          { path: "/", title: "Главная" },
          { path: "/", title: "Ещё главная" },
        ],
      },
      {
        ...description,
        pages: [{ path: "/", title: "Главная", searchTexts: "title" }],
      },
      {
        ...description,
        pages: [
          { path: "/", title: "Главная" },
          { path: "/menu/", title: "Меню" },
        ],
      },
    ];

    for (const input of broken)
      expect(readSiteDescription(input)).toBeUndefined();
  });

  it("says every problem of a description", () => {
    const reading = checkSiteDescription({
      ...description,
      id: "Coffee Shop",
      initialContent: { title: 3 },
      pages: [
        { path: "/menu", title: "Меню" },
        { path: "/menu", title: "Меню" },
        { path: "/about/", title: "О нас" },
        { path: "/team", title: " " },
        { path: "/news", title: "Новости", searchTexts: "title" },
        "/contacts",
      ],
    });

    expect(reading).toEqual({
      status: "invalid",
      problems: [
        { code: "invalid-id" },
        {
          code: "invalid-initial-content",
          issues: [{ path: ["title"], code: "invalid-type" }],
        },
        { code: "invalid-page", index: 2, reason: "invalid-path" },
        { code: "invalid-page", index: 3, reason: "invalid-title" },
        { code: "invalid-page", index: 4, reason: "invalid-search-texts" },
        { code: "invalid-page", index: 5, reason: "not-a-page" },
        { code: "home-page-not-first" },
        { code: "repeated-page-path", path: "/menu" },
      ],
    });
  });

  it("says why a schema is not one", () => {
    expect(
      checkSiteDescription({
        ...description,
        schema: { "a.b": { kind: "text", label: "Т" } },
      }),
    ).toEqual({
      status: "invalid",
      problems: [
        {
          code: "invalid-schema",
          problem: { path: ["a.b"], reason: "invalid-name" },
        },
      ],
    });
  });

  describe("the pages of records", () => {
    const shop = defineSchema({
      title: text({ label: "Заголовок" }),
      products: collection({
        label: "Товары",
        item: {
          name: text({ label: "Название" }),
          address: slug({ label: "Адрес страницы" }),
          seo: group({
            label: "Поиск",
            fields: {
              title: text({ label: "Заголовок" }),
              description: text({ label: "Описание" }),
            },
          }),
        },
      }),
    });
    const shopDescription = {
      id: "shop",
      title: "Магазин",
      schema: shop,
      initialContent: {
        title: "Магазин",
        products: [
          {
            name: "Баня",
            address: "banya",
            seo: { title: "", description: "" },
          },
          {
            id: "dom",
            name: "Дом",
            address: "",
            seo: { title: "", description: "" },
          },
        ],
      },
      pages: [
        { path: "/", title: "Главная" },
        { path: "/catalog", title: "Каталог" },
      ],
      recordPages: [
        {
          path: "/catalog/[record]",
          collection: "products",
          searchTexts: "seo",
        },
      ],
    };

    it("reads them through JSON, and leaves them out of a site without them", () => {
      const json: unknown = JSON.parse(JSON.stringify(shopDescription));

      expect(readSiteDescription(json)).toEqual(shopDescription);
      expect(readSiteDescription(description)).not.toHaveProperty(
        "recordPages",
      );
    });

    it("says every problem of them", () => {
      const reading = checkSiteDescription({
        ...shopDescription,
        pages: [
          ...shopDescription.pages,
          { path: "/catalog/sale", title: "Скидки" },
        ],
        recordPages: [
          { path: "/catalog/[record]", collection: "products" },
          { path: "/shop/[record]", collection: "products" },
          { path: "/[record]", collection: "products" },
          { path: "/news/[record]", collection: "news" },
          {
            path: "/goods/[record]",
            collection: "products",
            searchTexts: "name",
          },
          "/catalog/[record]",
        ],
      });

      expect(reading).toEqual({
        status: "invalid",
        problems: [
          { code: "invalid-record-page", index: 2, reason: "invalid-path" },
          {
            code: "invalid-record-page",
            index: 3,
            reason: "unknown-collection",
          },
          {
            code: "invalid-record-page",
            index: 4,
            reason: "invalid-search-texts",
          },
          { code: "invalid-record-page", index: 5, reason: "not-a-page" },
          { code: "repeated-record-pages", collection: "products" },
        ],
      });
    });

    it("refuses a page of the site among them, and a record without an address", () => {
      const reading = checkSiteDescription({
        ...shopDescription,
        pages: [
          ...shopDescription.pages,
          { path: "/catalog/sale", title: "Скидки" },
        ],
        initialContent: {
          ...shopDescription.initialContent,
          products: [
            { name: "Баня", address: "", seo: { title: "", description: "" } },
          ],
        },
      });

      expect(reading).toEqual({
        status: "invalid",
        problems: [
          { code: "page-among-record-pages", path: "/catalog/sale" },
          { code: "record-without-address", collection: "products", index: 0 },
        ],
      });
    });

    it("refuses two records of the initial content at one address", () => {
      const record = {
        name: "Баня",
        address: "",
        seo: { title: "", description: "" },
      };
      const reading = checkSiteDescription({
        ...shopDescription,
        initialContent: {
          ...shopDescription.initialContent,
          products: [
            { ...record, id: "banya" },
            { ...record, id: "banya" },
          ],
        },
      });

      expect(reading).toEqual({
        status: "invalid",
        problems: [
          {
            code: "repeated-record-address",
            collection: "products",
            address: "banya",
          },
        ],
      });
    });

    it("refuses pages of records that are not a list", () => {
      expect(
        checkSiteDescription({ ...shopDescription, recordPages: {} }),
      ).toEqual({
        status: "invalid",
        problems: [{ code: "invalid-record-pages" }],
      });
    });
  });
});

describe("the forms of a site's description", () => {
  const callback = requestForm({
    id: "callback",
    title: "Обратный звонок",
    fields: {
      name: requestText({ label: "Имя" }),
      phone: requestPhone({ label: "Телефон", required: true }),
    },
  });

  it("are read with the rest of the description", () => {
    const json: unknown = JSON.parse(
      JSON.stringify({ ...description, forms: [callback] }),
    );

    expect(readSiteDescription(json)).toEqual({
      ...description,
      forms: [callback],
    });
  });

  it("are left out when the site has none", () => {
    const reading = checkSiteDescription({ ...description, forms: [] });

    expect(reading).toEqual({ status: "read", description });
  });

  it("say which form is not one and which id is named twice", () => {
    const reading = checkSiteDescription({
      ...description,
      forms: [callback, { ...callback, title: "" }, callback],
    });

    expect(reading).toEqual({
      status: "invalid",
      problems: [
        { code: "invalid-form", index: 1, reason: "invalid-title" },
        { code: "repeated-form-id", id: "callback" },
      ],
    });
  });

  it("refuse forms that are not a list", () => {
    expect(checkSiteDescription({ ...description, forms: {} })).toEqual({
      status: "invalid",
      problems: [{ code: "invalid-forms" }],
    });
  });
});
