import { describe, expect, expectTypeOf, it } from "vitest";
import {
  choice,
  choices,
  collection,
  defaultContent,
  defineSchema,
  parseContent,
  text,
  time,
  toggle,
  url,
  type ContentOf,
} from "./index";

// The fields a site picks values from (a toggle, options), and the ones of a fixed format (an
// address without a text, a time of day).

const LEVELS = [
  { value: "soft", label: "Мягко" },
  { value: "active", label: "Активно" },
] as const;

const DAYS = [
  { value: "mon", label: "Пн" },
  { value: "wed", label: "Ср" },
  { value: "fri", label: "Пт" },
] as const;

const schema = defineSchema({
  practices: collection({
    label: "Практики",
    itemTitle: "name",
    item: {
      name: text({ label: "Название" }),
      isForBeginners: toggle({ label: "Можно новичкам" }),
      level: choice({ label: "Нагрузка", options: LEVELS }),
      days: choices({ label: "Дни", options: DAYS }),
      booking: url({ label: "Виджет записи" }),
      startsAt: time({ label: "Начало" }),
    },
  }),
});

const practice = {
  name: "Инь-йога",
  isForBeginners: true,
  level: "soft",
  days: ["mon", "fri"],
  booking: "https://studio.impulsemini.ru/widget/6",
  startsAt: "07:30",
};

function parsedPractice(changes: Readonly<Record<string, unknown>>) {
  return parseContent(schema, { practices: [{ ...practice, ...changes }] });
}

describe("choices, toggles, addresses and times", () => {
  it("give a site the exact values of its options", () => {
    type Practice = ContentOf<typeof schema>["practices"][number];

    expectTypeOf<Practice["isForBeginners"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Practice["level"]>().toEqualTypeOf<"soft" | "active" | null>();
    expectTypeOf<Practice["days"]>().toEqualTypeOf<
      readonly ("mon" | "wed" | "fri")[]
    >();
    expectTypeOf<Practice["booking"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Practice["startsAt"]>().toEqualTypeOf<string | null>();
  });

  it("start off, empty and unset", () => {
    const record = defaultContent(schema.practices.item);

    expect(record).toEqual({
      name: "",
      isForBeginners: false,
      level: null,
      days: [],
      booking: null,
      startsAt: null,
    });
  });

  it("keep valid values as they are", () => {
    const parsed = parseContent(schema, { practices: [practice] });

    expect(parsed.issues).toEqual([]);
    expect(parsed.content.practices[0]).toEqual(practice);
  });

  it("keep an option the schema no longer lists, with an issue", () => {
    const single = parsedPractice({ level: "gentle" });
    const several = parsedPractice({ days: ["mon", "sun"] });

    expect(single.content.practices[0]?.level).toBe("gentle");
    expect(single.issues).toEqual([
      {
        path: ["practices", 0, "level"],
        code: "unknown-choice",
        value: "gentle",
      },
    ]);
    expect(several.issues).toEqual([
      {
        path: ["practices", 0, "days"],
        code: "unknown-choice",
        value: "sun",
      },
    ]);
  });

  it("pick an option once, however many times it came", () => {
    const parsed = parsedPractice({ days: ["mon", "mon", "fri"] });

    expect(parsed.content.practices[0]?.days).toEqual(["mon", "fri"]);
  });

  it("replace values of another type with the default, with an issue", () => {
    const parsed = parsedPractice({
      isForBeginners: "yes",
      level: 2,
      days: "mon",
      booking: 6,
      startsAt: 730,
    });
    const codes = parsed.issues.map((issue) => issue.code);

    expect(parsed.content.practices[0]).toEqual({
      ...defaultContent(schema.practices.item),
      name: "Инь-йога",
    });
    expect(codes).toEqual(Array(5).fill("invalid-type"));
  });

  it("take only web addresses for an address, keeping another one with an issue", () => {
    const page = parsedPractice({ booking: "/raspisanie" });
    const script = parsedPractice({ booking: "javascript:alert(1)" });

    expect(page.issues).toEqual([
      { path: ["practices", 0, "booking"], code: "unsupported-url" },
    ]);
    expect(script.content.practices[0]?.booking).toBe("javascript:alert(1)");
    expect(script.issues.map((issue) => issue.code)).toEqual([
      "unsupported-url",
    ]);
  });

  it("take only a time of a day, from 00:00 to 23:59", () => {
    const invalid = ["24:00", "7:30", "07:60", "07:30:00"];

    expect(parsedPractice({ startsAt: "00:00" }).issues).toEqual([]);
    expect(parsedPractice({ startsAt: "23:59" }).issues).toEqual([]);
    for (const startsAt of invalid) {
      const parsed = parsedPractice({ startsAt });
      expect(parsed.content.practices[0]?.startsAt).toBeNull();
      expect(parsed.issues).toEqual([
        { path: ["practices", 0, "startsAt"], code: "invalid-time" },
      ]);
    }
  });
});
