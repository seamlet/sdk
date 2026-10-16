import { describe, expect, expectTypeOf, it } from "vitest";
import {
  collection,
  countCharacters,
  date,
  defaultContent,
  defineSchema,
  formatFieldPath,
  group,
  image,
  link,
  number,
  parseContent,
  text,
  type ContentOf,
  type ImageValue,
} from "./index";

const schema = defineSchema({
  title: text({ label: "Title", maxLength: 5 }),
  opensOn: date({ label: "Opens on" }),
  booking: link({ label: "Booking" }),
  hero: group({
    label: "Hero",
    fields: { photo: image({ label: "Photo" }) },
  }),
  menu: collection({
    label: "Menu",
    itemTitle: "name",
    item: {
      name: text({ label: "Name" }),
      price: number({ label: "Price", min: 0, max: 1000 }),
    },
  }),
});

const validContent = {
  title: "Grain",
  opensOn: "2026-10-18",
  booking: { text: "Book", href: "/booking" },
  hero: { photo: { src: "/hero.svg", alt: "A cup" } },
  menu: [
    { name: "Espresso", price: 150 },
    { name: "Latte", price: null },
  ],
};

describe("ContentOf", () => {
  it("gives a site the types of its content", () => {
    type SiteContent = ContentOf<typeof schema>;

    expectTypeOf<SiteContent["title"]>().toEqualTypeOf<string>();
    expectTypeOf<SiteContent["opensOn"]>().toEqualTypeOf<string | null>();
    expectTypeOf<
      SiteContent["hero"]["photo"]
    >().toEqualTypeOf<ImageValue | null>();
    expectTypeOf<SiteContent["menu"][number]["price"]>().toEqualTypeOf<
      number | null
    >();
  });
});

describe("defaultContent", () => {
  it("fills every field: empty text, unset scalars, default groups and empty collections", () => {
    expect(defaultContent(schema)).toEqual({
      title: "",
      opensOn: null,
      booking: null,
      hero: { photo: null },
      menu: [],
    });
  });
});

describe("parseContent", () => {
  it("accepts content that matches the schema", () => {
    const parsed = parseContent(schema, validContent);

    expect(parsed.issues).toEqual([]);
    expect(parsed.content).toEqual(validContent);
  });

  it("gives missing fields their defaults without issues, so a schema can grow", () => {
    const parsed = parseContent(schema, { title: "Grain" });

    expect(parsed.issues).toEqual([]);
    expect(parsed.content).toEqual({
      ...defaultContent(schema),
      title: "Grain",
    });
  });

  it("drops keys the schema does not know", () => {
    const parsed = parseContent(schema, { ...validContent, legacy: "old" });

    expect(parsed.issues).toEqual([]);
    expect(parsed.content).not.toHaveProperty("legacy");
  });

  it("replaces values of the wrong type with defaults and reports their paths", () => {
    const parsed = parseContent(schema, {
      title: 42,
      opensOn: true,
      hero: "photo",
      menu: [{ name: "Espresso", price: "150" }, "Latte"],
    });

    expect(parsed.content).toEqual({
      title: "",
      opensOn: null,
      booking: null,
      hero: { photo: null },
      menu: [
        { name: "Espresso", price: null },
        { name: "", price: null },
      ],
    });
    expect(parsed.issues.map((issue) => formatFieldPath(issue.path))).toEqual([
      "title",
      "opensOn",
      "hero",
      "menu.0.price",
      "menu.1",
    ]);
  });

  it("keeps values that break a rule of their field, with an issue", () => {
    const parsed = parseContent(schema, {
      ...validContent,
      title: "Coffee house",
      menu: [
        { name: "Espresso", price: -1 },
        { name: "Gold", price: 5000 },
      ],
    });

    expect(parsed.content.title).toBe("Coffee house");
    expect(parsed.content.menu.map((record) => record.price)).toEqual([
      -1, 5000,
    ]);
    expect(parsed.issues).toEqual([
      { path: ["title"], code: "too-long", maxLength: 5 },
      { path: ["menu", 0, "price"], code: "below-min", min: 0 },
      { path: ["menu", 1, "price"], code: "above-max", max: 1000 },
    ]);
  });

  it("counts the length of a text in characters as people see them", () => {
    // "й" written as и + a combining breve, an emoji with a skin tone, a cup: one character each.
    const fiveCharacters = "\u0438\u0306\u{1F44D}\u{1F3FD}☕аб";
    const sixCharacters = `${fiveCharacters}в`;

    expect(countCharacters(fiveCharacters)).toBe(5);
    expect(
      parseContent(schema, { ...validContent, title: fiveCharacters }).issues,
    ).toEqual([]);
    expect(
      parseContent(schema, { ...validContent, title: sixCharacters }).issues,
    ).toEqual([{ path: ["title"], code: "too-long", maxLength: 5 }]);
  });

  it("accepts only dates of real days in the YYYY-MM-DD format", () => {
    const invalidDates = ["2026-02-30", "18.10.2026", "2026-10-18T10:00"];

    for (const opensOn of invalidDates) {
      const parsed = parseContent(schema, { ...validContent, opensOn });

      expect(parsed.content.opensOn).toBeNull();
      expect(parsed.issues).toEqual([
        { path: ["opensOn"], code: "invalid-date" },
      ]);
    }
  });

  it("asks for the address of an image that has only its alternative text", () => {
    const parsed = parseContent(schema, {
      ...validContent,
      hero: { photo: { src: " ", alt: "A cup" } },
    });

    expect(parsed.content.hero.photo).toEqual({ src: " ", alt: "A cup" });
    expect(parsed.issues).toEqual([
      { path: ["hero", "photo"], code: "missing-image-src" },
    ]);
  });

  it("reads only own keys of the input", () => {
    const inherited = Object.create({ title: "From the prototype" }) as object;

    expect(parseContent(schema, inherited).content.title).toBe("");
  });

  it("replaces input that is not an object with the default content", () => {
    const parsed = parseContent(schema, ["not", "content"]);

    expect(parsed.content).toEqual(defaultContent(schema));
    expect(parsed.issues).toEqual([{ path: [], code: "invalid-type" }]);
  });

  it("keeps a link that leads nowhere or somewhere a link may not, with an issue", () => {
    const withHref = (href: string) =>
      parseContent(schema, {
        ...validContent,
        booking: { text: "Book", href },
      });

    expect(withHref("https://yclients.com/zerno").issues).toEqual([]);
    expect(withHref(" ").issues).toEqual([
      { path: ["booking"], code: "missing-link-href" },
    ]);
    expect(withHref("javascript:alert(1)").issues).toEqual([
      { path: ["booking"], code: "unsupported-link-href" },
    ]);
    expect(withHref("javascript:alert(1)").content.booking).toEqual({
      text: "Book",
      href: "javascript:alert(1)",
    });
    expect(
      parseContent(schema, { ...validContent, booking: { href: "/" } }).issues,
    ).toEqual([{ path: ["booking"], code: "invalid-type" }]);
  });
});
