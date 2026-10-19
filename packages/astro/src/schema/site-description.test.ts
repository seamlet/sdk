import { describe, expect, it } from "vitest";
import { defineSchema, group, text } from ".";
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
});
