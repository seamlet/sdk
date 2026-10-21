import type { GetStaticPaths } from "astro";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { describe, expect, it } from "vitest";
import {
  collection,
  defineSchema,
  recordPages,
  slug,
  text,
  toggle,
} from "./schema";
import {
  pageParameterOf,
  pagePathOf,
  previewedPageAt,
  renderedPageAt,
  staticPagesOf,
  type SitePages,
} from "./site-pages";

const component = (name: string) =>
  (() => name) as unknown as AstroComponentFactory;
const HomePage = component("home");
const MenuPage = component("menu");
const DrinkPage = component("drink");

const schema = defineSchema({
  title: text({ label: "Заголовок" }),
  menu: collection({
    label: "Меню",
    item: {
      name: text({ label: "Название" }),
      slug: slug({ label: "Адрес" }),
      isHidden: toggle({ label: "Скрыть с сайта" }),
    },
  }),
});

const site: SitePages = {
  schema,
  pages: {
    "/": { title: "Главная", component: HomePage },
    "/menu": { title: "Меню", component: MenuPage },
  },
  recordPages: [
    {
      pages: recordPages(schema, {
        collection: "menu",
        path: "/menu/[record]",
        shows: (drink) => !drink.isHidden,
      }),
      component: DrinkPage,
    },
  ],
};

const latte = { id: "d1", name: "Латте", slug: "latte", isHidden: false };
const raf = { id: "d2", name: "Раф", slug: "", isHidden: false };
const cocoa = { id: "d3", name: "Какао", slug: "kakao", isHidden: true };
const content = { title: "Зерно", menu: [latte, raf, cocoa] };

describe("renderedPageAt", () => {
  it("renders a page of the site with the content", () => {
    expect(renderedPageAt(site, "/menu", content)).toEqual({
      component: MenuPage,
      props: { content },
    });
  });

  it("renders the page of a record with the record and its place", () => {
    expect(renderedPageAt(site, "/menu/latte", content)).toEqual({
      component: DrinkPage,
      props: { content, record: latte, index: 0 },
    });
    expect(renderedPageAt(site, "/menu/d2", content)).toEqual({
      component: DrinkPage,
      props: { content, record: raf, index: 1 },
    });
  });

  it("renders nothing where the site has no page", () => {
    expect(renderedPageAt(site, "/about", content)).toBeUndefined();
    expect(renderedPageAt(site, "/menu/tea", content)).toBeUndefined();
  });

  it("renders no page of a record the site does not show, but the preview does", () => {
    expect(renderedPageAt(site, "/menu/kakao", content)).toBeUndefined();
    expect(previewedPageAt(site, "/menu/kakao", content)).toEqual({
      component: DrinkPage,
      props: { content, record: cocoa, index: 2 },
    });
  });
});

describe("staticPagesOf", () => {
  it("builds every page of the site and a page of every record", () => {
    const pages = staticPagesOf(site, content);

    expect(pages.map((page) => page.params.page)).toEqual([
      undefined,
      "menu",
      "menu/latte",
      "menu/d2",
    ]);
    expect(pages[2]?.props).toEqual({
      component: DrinkPage,
      props: { content, record: latte, index: 0 },
    });
  });

  it("builds no page of a record without an address, or one the site does not show", () => {
    const pages = staticPagesOf(site, {
      ...content,
      menu: [{ name: "Чай", slug: "", isHidden: false }, cocoa],
    });

    expect(pages).toHaveLength(2);
  });

  it("is what getStaticPaths of an Astro route may return", () => {
    const getStaticPaths = (() =>
      staticPagesOf(site, content)) satisfies GetStaticPaths;

    expect(getStaticPaths()).toEqual(staticPagesOf(site, content));
  });
});

describe("the rest of an address", () => {
  it("is nothing for the home page", () => {
    expect(pagePathOf(undefined)).toBe("/");
    expect(pagePathOf("menu/latte")).toBe("/menu/latte");
    expect(pageParameterOf("/")).toBeUndefined();
    expect(pageParameterOf("/menu/latte")).toBe("menu/latte");
  });
});
