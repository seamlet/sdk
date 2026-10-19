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
});
