import { describe, expect, it } from "vitest";
import {
  maxLengthOf,
  readRequestForm,
  requestChoice,
  requestForm,
  requestLongText,
  requestPhone,
  requestText,
} from "./request-forms";

const callback = requestForm({
  id: "callback",
  title: "Обратный звонок",
  fields: {
    name: requestText({ label: "Имя" }),
    phone: requestPhone({ label: "Телефон", required: true }),
    preferredTime: requestChoice({
      label: "Когда позвонить",
      options: ["Утром", "Вечером"],
    }),
    comment: requestLongText({ label: "Комментарий", maxLength: 500 }),
  },
});

describe("readRequestForm", () => {
  it("reads a form back from JSON as it was declared", () => {
    const json: unknown = JSON.parse(JSON.stringify(callback));

    expect(readRequestForm(json)).toEqual({ status: "read", form: callback });
  });

  it.each([
    [null, "not-a-form"],
    [{ ...callback, id: "Callback" }, "invalid-id"],
    [{ ...callback, title: " " }, "invalid-title"],
    [{ ...callback, fields: {} }, "no-fields"],
    [
      { ...callback, fields: { "seamlet-form": callback.fields.name } },
      "invalid-field-name",
    ],
    [
      { ...callback, fields: { name: { kind: "file", label: "Файл" } } },
      "invalid-field",
    ],
    [
      { ...callback, fields: { name: { kind: "text", label: "" } } },
      "invalid-field",
    ],
    [
      {
        ...callback,
        fields: { name: { kind: "text", label: "Имя", maxLength: 0 } },
      },
      "invalid-field",
    ],
    [
      {
        ...callback,
        fields: {
          time: { kind: "choice", label: "Когда", options: ["Утром", "Утром"] },
        },
      },
      "invalid-field",
    ],
    [
      {
        ...callback,
        fields: { phone: { kind: "phone", label: "Телефон", required: "yes" } },
      },
      "invalid-field",
    ],
    [
      {
        ...callback,
        fields: {
          time: { kind: "choice", label: "Когда", options: [" Утром"] },
        },
      },
      "invalid-field",
    ],
  ])("refuses %j as %s", (input, reason) => {
    expect(readRequestForm(input)).toEqual({ status: "invalid", reason });
  });
});

describe("maxLengthOf", () => {
  it("takes the site's limit, or the default of the field's kind", () => {
    expect(maxLengthOf(callback.fields.comment)).toBe(500);
    expect(maxLengthOf(callback.fields.name)).toBe(200);
    expect(maxLengthOf(requestLongText({ label: "Вопрос" }))).toBe(2000);
  });
});
