import { describe, expect, it } from "vitest";
import {
  choice,
  collection,
  defineSchema,
  group,
  image,
  number,
  reference,
  richText,
  slug,
  text,
  toggle,
} from ".";
import { checkFields, readFields } from "./read-fields";

const schema = defineSchema({
  title: text({ label: "Заголовок", maxLength: 60 }),
  about: richText({ label: "О нас", inline: true }),
  hero: group({
    label: "Первый экран",
    fields: {
      photo: image({ label: "Фото" }),
      isShown: toggle({ label: "Показать" }),
    },
  }),
  teachers: collection({
    label: "Преподаватели",
    itemTitle: "name",
    item: { name: text({ label: "Имя" }) },
  }),
  practices: collection({
    label: "Практики",
    item: {
      pace: choice({
        label: "Нагрузка",
        options: [{ value: "soft", label: "Мягкая" }],
      }),
      teacher: reference({ label: "Ведёт", collection: "teachers" }),
      price: number({ label: "Цена", min: 0 }),
    },
  }),
});

describe("readFields", () => {
  it("reads back a schema that went through JSON", () => {
    const json: unknown = JSON.parse(JSON.stringify(schema));

    expect(readFields(json)).toEqual(schema);
  });

  it("keeps only what the schema language knows", () => {
    expect(
      readFields({ title: { kind: "text", label: "Заголовок", color: "red" } }),
    ).toEqual({ title: { kind: "text", label: "Заголовок" } });
  });

  it("reads nothing from what is not a schema", () => {
    expect(readFields([])).toBeUndefined();
    expect(
      readFields({ title: { kind: "video", label: "Видео" } }),
    ).toBeUndefined();
    expect(readFields({ title: { kind: "text" } })).toBeUndefined();
    expect(
      readFields({
        menu: {
          kind: "collection",
          label: "Меню",
          item: { id: { kind: "text", label: "Id" } },
        },
      }),
    ).toBeUndefined();
    expect(
      readFields({
        menu: {
          kind: "collection",
          label: "Меню",
          itemTitle: "name",
          item: { title: { kind: "text", label: "Название" } },
        },
      }),
    ).toBeUndefined();
    expect(
      readFields({
        pace: { kind: "choice", label: "Нагрузка", options: [{ value: 1 }] },
      }),
    ).toBeUndefined();
  });

  it("reads nothing from a schema that cannot work, and says where", () => {
    const text = { kind: "text", label: "Текст" };
    const cases: readonly [unknown, readonly string[], string][] = [
      [{ "hero.title": text }, ["hero.title"], "invalid-name"],
      [
        { hero: { kind: "group", label: "Экран", fields: { "2": text } } },
        ["hero", "2"],
        "invalid-name",
      ],
      [{ "": text }, [""], "invalid-name"],
      [{ title: { ...text, maxLength: "10" } }, ["title"], "invalid-option"],
      [{ title: { ...text, multiline: "yes" } }, ["title"], "invalid-option"],
      [
        { price: { kind: "number", label: "Цена", min: Number.NaN } },
        ["price"],
        "invalid-option",
      ],
      [
        {
          teacher: {
            kind: "reference",
            label: "Ведёт",
            collection: "teachers",
          },
        },
        ["teacher"],
        "unknown-collection",
      ],
      [
        {
          practices: {
            kind: "collection",
            label: "Практики",
            item: {
              teachers: {
                kind: "references",
                label: "Ведут",
                collection: "studio.teachers",
              },
            },
          },
        },
        ["practices", "teachers"],
        "unknown-collection",
      ],
      [
        {
          menu: {
            kind: "collection",
            label: "Меню",
            itemTitle: "price",
            item: { price: { kind: "number", label: "Цена" } },
          },
        },
        ["menu"],
        "invalid-item-title",
      ],
      [
        {
          menu: {
            kind: "collection",
            label: "Меню",
            itemTitle: "about",
            item: { about: { kind: "richText", label: "О блюде" } },
          },
        },
        ["menu"],
        "invalid-item-title",
      ],
    ];

    for (const [input, path, reason] of cases) {
      expect(readFields(input)).toBeUndefined();
      expect(checkFields(input)).toEqual({
        status: "invalid",
        problem: { path, reason },
      });
    }
  });

  it("reads a reference to a collection inside a group, and a link that titles a record", () => {
    const input = {
      studio: {
        kind: "group",
        label: "Студия",
        fields: {
          teachers: {
            kind: "collection",
            label: "Преподаватели",
            itemTitle: "page",
            item: { page: { kind: "link", label: "Страница" } },
          },
        },
      },
      lead: {
        kind: "reference",
        label: "Ведёт",
        collection: "studio.teachers",
      },
    };

    expect(checkFields(input)).toEqual({ status: "read", fields: input });
  });

  it("takes one slug of a record, and no slug elsewhere", () => {
    const record = (item: object) => ({
      products: { kind: "collection", label: "Товары", item },
    });
    const slugField = slug({ label: "Адрес" });
    const name = text({ label: "Название" });

    expect(checkFields(record({ name, address: slugField }))).toEqual({
      status: "read",
      fields: record({ name, address: slugField }),
    });
    expect(checkFields({ address: slugField })).toEqual({
      status: "invalid",
      problem: { path: ["address"], reason: "misplaced-slug" },
    });
    expect(
      checkFields(record({ first: slugField, second: slugField })),
    ).toEqual({
      status: "invalid",
      problem: { path: ["products", "second"], reason: "misplaced-slug" },
    });
    expect(
      checkFields(
        record({
          seo: {
            kind: "group",
            label: "Поиск",
            fields: { address: slugField },
          },
        }),
      ),
    ).toEqual({
      status: "invalid",
      problem: {
        path: ["products", "seo", "address"],
        reason: "misplaced-slug",
      },
    });
  });
});
