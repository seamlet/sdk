import { describe, expect, it } from "vitest";
import { defaultContent, defineSchema, group, parseContent } from "./index";
import { calendarDayIn, isShownOn, shownUntilField } from "./shown-until";

describe("isShownOn", () => {
  it("shows a record up to and including its last day", () => {
    expect(isShownOn("2026-11-01", "2026-10-28")).toBe(true);
    expect(isShownOn("2026-11-01", "2026-11-01")).toBe(true);
    expect(isShownOn("2026-11-01", "2026-11-02")).toBe(false);
  });

  it("shows a record without a last day always", () => {
    expect(isShownOn(null, "2030-01-01")).toBe(true);
    expect(isShownOn("", "2030-01-01")).toBe(true);
  });
});

describe("calendarDayIn", () => {
  it("names the day where the business is, not where the server is", () => {
    // 22:30 in UTC on October 31 is already November 1 in Kirov, three hours ahead.
    const moment = new Date(Date.UTC(2026, 9, 31, 22, 30));

    expect(calendarDayIn("Europe/Kirov", moment)).toBe("2026-11-01");
    expect(calendarDayIn("UTC", moment)).toBe("2026-10-31");
  });
});

describe("shownUntilField", () => {
  it("is a date, empty until the owner sets one", () => {
    const schema = defineSchema({
      offer: group({
        label: "Предложение",
        fields: { shownUntil: shownUntilField() },
      }),
    });

    expect(defaultContent(schema)).toEqual({ offer: { shownUntil: null } });
    expect(
      parseContent(schema, { offer: { shownUntil: "2026-11-01" } }).issues,
    ).toEqual([]);
  });
});
