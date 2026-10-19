import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { describe, expect, it } from "vitest";
import { defineSchema, readSiteDescription, text } from "./schema";
import { describeSite } from "./site-descriptions";

const component = (() => "") as unknown as AstroComponentFactory;
const schema = defineSchema({ title: text({ label: "Заголовок" }) });

describe("describeSite", () => {
  it("tells the CMS everything about the site but how it renders, in a form it reads", () => {
    const description = describeSite(
      { id: "coffee-shop", title: "Кофейня «Зерно»" },
      {
        schema,
        initialContent: { title: "Зерно" },
        pages: {
          "/": { title: "Главная", component },
          "/menu": { title: "Меню", component },
        },
      },
    );

    expect(description.pages).toEqual([
      { path: "/", title: "Главная" },
      { path: "/menu", title: "Меню" },
    ]);
    expect(
      readSiteDescription(JSON.parse(JSON.stringify(description))),
    ).toEqual(description);
  });

  it("stops a site the CMS would refuse and says what to fix", () => {
    const describe = (
      pages: Record<
        string,
        { title: string; component: AstroComponentFactory }
      >,
      initialContent = { title: "Зерно" },
    ) =>
      describeSite(
        { id: "coffee-shop", title: "Кофейня «Зерно»" },
        { schema, initialContent, pages },
      );

    expect(() => describe({ "/Menu": { title: "Меню", component } })).toThrow(
      /page 1 of pages: its address/u,
    );
    expect(() =>
      describe({
        "/": { title: "Главная", component },
        "/menu/": { title: "Меню", component },
      }),
    ).toThrow(/page 2 of pages/u);
    expect(() => describe({ "/menu": { title: "Меню", component } })).toThrow(
      /the first of the pages is not the home page/u,
    );
    expect(() => describe({})).toThrow(/it has no pages/u);
    expect(() =>
      describe({ "/": { title: "Главная", component } }, {
        title: 3,
      } as unknown as { title: string }),
    ).toThrow(/the initial content: "title" is invalid-type/u);
  });

  it("stops a page whose search texts are not a group of a title and a description", () => {
    expect(() =>
      describeSite(
        { id: "coffee-shop", title: "Кофейня «Зерно»" },
        {
          schema,
          initialContent: { title: "Зерно" },
          pages: { "/": { title: "Главная", component, searchTexts: "title" } },
        },
      ),
    ).toThrow(/searchTexts names no group/u);
  });
});
