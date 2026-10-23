import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { describe, expect, it } from "vitest";
import {
  collection,
  defineSchema,
  group,
  recordPages,
  seoFields,
  slug,
  text,
  toggle,
  type Content,
  type SiteDescription,
} from "./schema";
import { searchPagesOf } from "./search-pages";
import { staticPagesOf, type SitePages } from "./site-pages";

const schema = defineSchema({
  title: text({ label: "Заголовок" }),
  seo: group({ label: "Поисковики", fields: { home: seoFields() } }),
  menu: collection({
    label: "Меню",
    itemTitle: "name",
    item: {
      name: text({ label: "Название" }),
      slug: slug({ label: "Адрес" }),
      isHidden: toggle({ label: "Скрыть с сайта" }),
      seo: seoFields(),
    },
  }),
});

const drinkPages = recordPages(schema, {
  collection: "menu",
  path: "/menu/[record]",
  searchTexts: "seo",
  shows: (drink) => !drink.isHidden,
});

// The pages are never rendered here: only what lists them is.
const component = (() => "") as unknown as AstroComponentFactory;

const site: SitePages = {
  schema,
  pages: {
    "/": { title: "Главная", component, searchTexts: "seo.home" },
    "/menu": { title: "Меню", component },
  },
  recordPages: [{ pages: drinkPages, component }],
};

const description: SiteDescription = {
  id: "cafe",
  title: "Моя кофейня",
  schema,
  initialContent: {},
  pages: [
    { path: "/", title: "Главная", searchTexts: "seo.home" },
    { path: "/menu", title: "Меню" },
  ],
  recordPages: [
    { path: "/menu/[record]", collection: "menu", searchTexts: "seo" },
  ],
};

const noSeo = { title: "", description: "", image: null };

const content: Content = {
  title: "Кофейня",
  seo: {
    home: {
      title: "Кофейня у парка",
      description: "Кофе и завтраки",
      image: null,
    },
  },
  menu: [
    {
      id: "d1",
      name: "Латте",
      slug: "latte",
      isHidden: false,
      seo: { title: "", description: "Мягкий кофе с молоком", image: null },
    },
    { id: "d2", name: "Раф", slug: "", isHidden: true, seo: noSeo },
    {
      id: "d3",
      name: "Капучино",
      slug: "",
      isHidden: false,
      seo: { title: "Капучино на кокосовом", description: "", image: null },
    },
  ],
};

describe("the pages search engines see", () => {
  const pages = searchPagesOf(description, staticPagesOf(site, content));

  it("are the site's own pages by their search titles, or their names", () => {
    expect(pages.slice(0, 2)).toEqual([
      { path: "/", name: "Кофейня у парка", description: "Кофе и завтраки" },
      { path: "/menu", name: "Меню", description: "" },
    ]);
  });

  it("are the pages of the records the site shows, under their collection", () => {
    expect(pages.slice(2)).toEqual([
      {
        path: "/menu/latte",
        name: "Латте",
        description: "Мягкий кофе с молоком",
        collection: "Меню",
      },
      {
        path: "/menu/d3",
        name: "Капучино на кокосовом",
        description: "",
        collection: "Меню",
      },
    ]);
  });
});
