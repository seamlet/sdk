import { describe, expect, it } from "vitest";
import {
  collection,
  date,
  defineSchema,
  image,
  link,
  number,
  richText,
  text,
  time,
} from "../schema";
import { typedKindAt } from "./typed-fields";

const schema = defineSchema({
  title: text({ label: "Заголовок" }),
  about: richText({ label: "О нас" }),
  menu: collection({
    label: "Меню",
    item: {
      name: text({ label: "Название" }),
      price: number({ label: "Цена" }),
      opensAt: time({ label: "Открытие" }),
      startsOn: date({ label: "Дата" }),
      photo: image({ label: "Фото" }),
      more: link({ label: "Подробнее" }),
    },
  }),
});

describe("typedKindAt", () => {
  it("tells how a field is typed in place", () => {
    expect(typedKindAt(schema, "title")).toBe("plain");
    expect(typedKindAt(schema, "about")).toBe("rich");
    expect(typedKindAt(schema, "menu.0.name")).toBe("plain");
    expect(typedKindAt(schema, "menu.0")).toBeUndefined();
  });

  it("types the words of a link, a number and a time as plain text, so a tap opens the keyboard", () => {
    expect(typedKindAt(schema, "menu.0.more")).toBe("plain");
    expect(typedKindAt(schema, "menu.0.price")).toBe("plain");
    expect(typedKindAt(schema, "menu.0.opensAt")).toBe("plain");
    expect(typedKindAt(schema, "menu.0.startsOn")).toBeUndefined();
    expect(typedKindAt(schema, "menu.0.photo")).toBeUndefined();
  });
});
