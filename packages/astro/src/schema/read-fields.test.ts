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
  text,
  toggle,
} from ".";
import { readFields } from "./read-fields";

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
});
