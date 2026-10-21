import { describe, expect, it } from "vitest";
import {
  requestChoice,
  requestEmail,
  requestForm,
  requestLongText,
  requestPhone,
  requestText,
} from "./request-forms";
import {
  isConsentGiven,
  isEmailAddress,
  isPhoneNumber,
  isTrapFilled,
  readRequestEntries,
  readRequestValues,
  REQUEST_CONSENT_KEY,
  REQUEST_PAGE_KEY,
  REQUEST_TRAP_KEY,
  requestPageOf,
} from "./request-values";

const estimate = requestForm({
  id: "estimate",
  title: "Рассчитать стоимость",
  fields: {
    name: requestText({ label: "Имя", required: true }),
    phone: requestPhone({ label: "Телефон", required: true }),
    email: requestEmail({ label: "Почта" }),
    size: requestChoice({ label: "Размер", options: ["6×4", "6×6"] }),
    comment: requestLongText({ label: "Комментарий", maxLength: 40 }),
  },
});

describe("readRequestValues", () => {
  it("takes the filled fields in the form's order, with their labels", () => {
    const reading = readRequestValues(estimate, {
      comment: "  Нужен фундамент\r\nи печь  ",
      phone: "+7 (912) 345-67-89",
      name: " Анна ",
      email: "",
    });

    expect(reading).toEqual({
      status: "read",
      values: [
        { field: "name", label: "Имя", value: "Анна" },
        { field: "phone", label: "Телефон", value: "+7 (912) 345-67-89" },
        {
          field: "comment",
          label: "Комментарий",
          value: "Нужен фундамент\nи печь",
        },
      ],
    });
  });

  it("names every field it cannot take", () => {
    const reading = readRequestValues(estimate, {
      name: "   ",
      phone: "позвоните мне",
      email: "anna@",
      size: "8×8",
      comment: "очень длинный комментарий, который не поместится",
    });

    expect(reading).toEqual({
      status: "invalid",
      issues: [
        { field: "name", code: "required" },
        { field: "phone", code: "invalid-phone" },
        { field: "email", code: "invalid-email" },
        { field: "size", code: "unknown-option" },
        { field: "comment", code: "too-long" },
      ],
    });
  });

  it("keeps a line of words on one line", () => {
    const reading = readRequestValues(estimate, {
      name: "Анна\nИвановна",
      phone: "123456",
    });

    expect(reading.status === "read" && reading.values[0]?.value).toBe(
      "Анна Ивановна",
    );
  });

  it("takes nothing but the form's fields", () => {
    const reading = readRequestValues(estimate, {
      name: "Анна",
      phone: "8 912 345 67 89",
      [REQUEST_PAGE_KEY]: "/catalog",
      role: "admin",
    });

    expect(
      reading.status === "read" && reading.values.map(({ field }) => field),
    ).toEqual(["name", "phone"]);
  });
});

describe("the request's own keys", () => {
  it("know a checked consent from an empty one", () => {
    expect(isConsentGiven({ [REQUEST_CONSENT_KEY]: "on" })).toBe(true);
    expect(isConsentGiven({ [REQUEST_CONSENT_KEY]: "true" })).toBe(true);
    expect(isConsentGiven({})).toBe(false);
    expect(isConsentGiven({ [REQUEST_CONSENT_KEY]: "" })).toBe(false);
  });

  it("know a request a program filled", () => {
    expect(isTrapFilled({ [REQUEST_TRAP_KEY]: "https://spam.example" })).toBe(
      true,
    );
    expect(isTrapFilled({ [REQUEST_TRAP_KEY]: " " })).toBe(false);
  });

  it("read the page a request was sent from, or the home page", () => {
    expect(requestPageOf({ [REQUEST_PAGE_KEY]: "/catalog/banya" })).toBe(
      "/catalog/banya",
    );
    expect(
      requestPageOf({ [REQUEST_PAGE_KEY]: "https://other.example/" }),
    ).toBe("/");
    expect(requestPageOf({})).toBe("/");
  });
});

describe("the rules of a request's words", () => {
  it.each([
    ["1234", false],
    ["12345", true],
    ["+7 (912) 345-67-89", true],
    ["123456789012345", true],
    ["1234567890123456", false],
    ["89+123456", false],
  ])("take %s as a phone number: %s", (typed, isNumber) => {
    expect(isPhoneNumber(typed)).toBe(isNumber);
  });

  it("take an email address up to the length mail carries", () => {
    const domain = "@example.ru";
    const longest = `${"a".repeat(254 - domain.length)}${domain}`;

    expect(isEmailAddress(longest)).toBe(true);
    expect(isEmailAddress(`a${longest}`)).toBe(false);
  });

  it.each(["//other.example/x", "/\\other.example/x", "/a b"])(
    "never take %s for a page of the site",
    (page) => {
      expect(requestPageOf({ [REQUEST_PAGE_KEY]: page })).toBe("/");
    },
  );
});

describe("readRequestEntries", () => {
  it("keeps the body's own words and drops any other value", () => {
    const body: unknown = JSON.parse(
      '{"name":"Анна","phone":5,"comment":null,"tags":["a"]}',
    );

    expect(readRequestEntries(body)).toEqual({ name: "Анна" });
    expect(readRequestEntries("name=Анна")).toEqual({});
  });

  it("never reads a name of an object's prototype as sent", () => {
    const form = requestForm({
      id: "odd",
      title: "Заявка",
      fields: { constructor: requestText({ label: "Имя" }) },
    });

    expect(readRequestValues(form, {})).toEqual({ status: "read", values: [] });
  });
});
