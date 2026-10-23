import { describe, expect, it } from "vitest";
import {
  checkFields,
  choice,
  choices,
  choiceTitleOf,
  collection,
  link,
  openingHoursField,
  recordTitleOf,
  text,
  WEEKDAYS,
} from "./index";

// A record named by one of its fields reads the same in the CMS and on the site: a text, a link's
// text, or the labels of the options picked.

const days = choices({ label: "Дни", options: WEEKDAYS });

const tags = choices({
  label: "Метки",
  options: [
    { value: "coffee", label: "Кофе" },
    { value: "tea", label: "Чай" },
    { value: "dessert", label: "Десерты" },
    { value: "vegan", label: "Без молока" },
  ],
});

const level = choice({
  label: "Нагрузка",
  options: [
    { value: "soft", label: "Мягко" },
    { value: "active", label: "Активно" },
  ],
});

describe("choiceTitleOf", () => {
  it("reads a choice as its option's label", () => {
    expect(choiceTitleOf(level, "active")).toBe("Активно");
    expect(choiceTitleOf(level, null)).toBe("");
  });

  it("joins the labels of choices in the schema's order", () => {
    expect(choiceTitleOf(tags, ["dessert", "coffee", "tea"])).toBe(
      "Кофе, Чай, Десерты",
    );
    expect(choiceTitleOf(tags, [])).toBe("");
  });

  it("writes three or more days of the week in a row as the first and the last", () => {
    expect(choiceTitleOf(days, ["mon", "tue", "wed", "thu", "fri"])).toBe(
      "Пн–Пт",
    );
    expect(
      choiceTitleOf(
        days,
        WEEKDAYS.map((day) => day.value),
      ),
    ).toBe("Пн–Вс");
    expect(choiceTitleOf(days, ["sun", "sat", "fri", "mon"])).toBe("Пн, Пт–Вс");
  });

  it("keeps two days in a row and days apart as they are", () => {
    expect(choiceTitleOf(days, ["sat", "sun"])).toBe("Сб, Вс");
    expect(choiceTitleOf(days, ["mon", "wed", "fri"])).toBe("Пн, Ср, Пт");
  });

  it("reads a few days of the week in their order as days", () => {
    const classDays = choices({
      label: "Дни",
      options: [
        { value: "mon", label: "Понедельник" },
        { value: "tue", label: "Вторник" },
        { value: "wed", label: "Среда" },
        { value: "fri", label: "Пятница" },
      ],
    });

    expect(choiceTitleOf(classDays, ["mon", "tue", "wed", "fri"])).toBe(
      "Понедельник–Среда, Пятница",
    );
  });

  it("never writes options that are not days as a range", () => {
    expect(choiceTitleOf(tags, ["coffee", "tea", "dessert", "vegan"])).toBe(
      "Кофе, Чай, Десерты, Без молока",
    );
  });

  it("reads a value the options no longer list as itself, after the others", () => {
    expect(choiceTitleOf(tags, ["gone", "tea"])).toBe("Чай, gone");
    expect(choiceTitleOf(level, "gone")).toBe("gone");
  });
});

describe("recordTitleOf", () => {
  it("reads a text and a link's text", () => {
    const named = collection({
      label: "Блюда",
      itemTitle: "name",
      item: { name: text({ label: "Название" }) },
    });
    const linked = collection({
      label: "Соцсети",
      itemTitle: "link",
      item: { link: link({ label: "Ссылка" }) },
    });

    expect(recordTitleOf(named, { name: " Латте " })).toBe("Латте");
    expect(
      recordTitleOf(linked, {
        link: { text: "Телеграм", href: "https://t.me" },
      }),
    ).toBe("Телеграм");
  });

  it("names a row of opening hours by its days", () => {
    expect(
      recordTitleOf(openingHoursField(), {
        days: ["mon", "tue", "wed", "thu", "fri"],
        opens: "08:00",
        closes: "21:00",
        note: "",
      }),
    ).toBe("Пн–Пт");
  });

  it("is empty for a collection without a title", () => {
    const untitled = collection({
      label: "Блюда",
      item: { name: text({ label: "Название" }) },
    });

    expect(recordTitleOf(untitled, { name: "Латте" })).toBe("");
  });
});

describe("a title by choices", () => {
  it("is a schema the CMS reads", () => {
    const reading = checkFields({ hours: openingHoursField() });

    expect(reading.status).toBe("read");
  });

  it("is a choice as well", () => {
    const reading = checkFields({
      practices: collection({
        label: "Практики",
        itemTitle: "level",
        item: { level },
      }),
    });

    expect(reading.status).toBe("read");
  });
});
