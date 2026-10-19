import { describe, expect, it } from "vitest";
import { defineSchema, group, text } from ".";
import { readSiteDescription } from "./site-description";

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
});
