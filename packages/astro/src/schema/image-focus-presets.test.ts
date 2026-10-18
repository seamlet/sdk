import { describe, expect, expectTypeOf, it } from "vitest";
import {
  contactsFields,
  defaultContent,
  defineSchema,
  image,
  imagePosition,
  openingHoursField,
  parseContent,
  seoFields,
  type ContentOf,
} from "./index";

const schema = defineSchema({ photo: image({ label: "Фото" }) });

describe("the focus of a photo", () => {
  it("is kept when it is inside the photo, and dropped otherwise", () => {
    const photo = (focus: unknown) =>
      parseContent(schema, { photo: { src: "/hall.webp", alt: "Зал", focus } })
        .content.photo;

    expect(photo({ x: 0.3, y: 1 })).toEqual({
      src: "/hall.webp",
      alt: "Зал",
      focus: { x: 0.3, y: 1 },
    });
    expect(photo({ x: 1.2, y: 0.5 })).toEqual({
      src: "/hall.webp",
      alt: "Зал",
    });
    expect(photo("top")).toEqual({ src: "/hall.webp", alt: "Зал" });
  });

  it("gives the position a site crops the photo around", () => {
    expect(
      imagePosition({ src: "/a.webp", alt: "", focus: { x: 0.25, y: 0.333 } }),
    ).toBe("25% 33.3%");
    expect(imagePosition({ src: "/a.webp", alt: "" })).toBe("50% 50%");
    expect(imagePosition(null)).toBe("50% 50%");
  });
});

describe("presets", () => {
  const site = defineSchema({
    seo: seoFields(),
    contacts: contactsFields({ label: "Как связаться" }),
    hours: openingHoursField(),
  });

  it("are the usual fields, with their labels in Russian", () => {
    expect(site.seo.label).toBe("Поисковики и соцсети");
    expect(site.contacts.label).toBe("Как связаться");
    expect(defaultContent(site)).toEqual({
      seo: { title: "", description: "", image: null },
      contacts: { phone: null, address: "", map: null, messengers: [] },
      hours: [],
    });
  });

  it("check content like any fields, the days of the hours by their values", () => {
    type Hours = ContentOf<typeof site>["hours"][number];
    const parsed = parseContent(site, {
      ...defaultContent(site),
      hours: [
        { days: ["mon", "fri"], opens: "07:00", closes: "21:00", note: "" },
      ],
    });

    expectTypeOf<Hours["days"][number]>().toEqualTypeOf<
      "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
    >();
    expect(parsed.issues).toEqual([]);
  });
});
