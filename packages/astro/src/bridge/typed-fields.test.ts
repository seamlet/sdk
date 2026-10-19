import { describe, expect, it } from "vitest";
import { collection, defineSchema, number, richText, text } from "../schema";
import { typedKindAt } from "./typed-fields";

const schema = defineSchema({
  title: text({ label: "Заголовок" }),
  about: richText({ label: "О нас" }),
  menu: collection({
    label: "Меню",
    item: {
      name: text({ label: "Название" }),
      price: number({ label: "Цена" }),
    },
  }),
});

describe("typedKindAt", () => {
  it("tells how a field is typed in place", () => {
    expect(typedKindAt(schema, "title")).toBe("plain");
    expect(typedKindAt(schema, "about")).toBe("rich");
    expect(typedKindAt(schema, "menu.0.name")).toBe("plain");
    expect(typedKindAt(schema, "menu.0.price")).toBeUndefined();
    expect(typedKindAt(schema, "menu.0")).toBeUndefined();
  });
});
