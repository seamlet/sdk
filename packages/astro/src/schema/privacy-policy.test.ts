import { describe, expect, it } from "vitest";
import {
  defaultContent,
  defineSchema,
  parseContent,
  plainTextOf,
  privacyPolicyFields,
  privacyPolicyTextOf,
  requestForm,
  requestPhone,
  requestText,
} from "./index";

const callback = requestForm({
  id: "callback",
  title: "Обратный звонок",
  fields: {
    name: requestText({ label: "Имя" }),
    phone: requestPhone({ label: "Телефон" }),
  },
});

const operator = {
  name: "ООО «Лесная мастерская»",
  inn: "4345000000",
  address: "610000, г. Киров, ул. Лесная, д. 1",
  email: "data@lesnaya.example",
};

function wordsOf(source: Parameters<typeof privacyPolicyTextOf>[0]): string {
  return plainTextOf(privacyPolicyTextOf(source));
}

describe("privacyPolicyTextOf", () => {
  it("names the business, the data its forms ask and how to withdraw the consent", () => {
    const words = wordsOf({
      siteTitle: "Лесная мастерская",
      operator,
      forms: [callback],
    });

    expect(words).toContain(
      "ООО «Лесная мастерская» (ИНН 4345000000, адрес: 610000, г. Киров, ул. Лесная, д. 1)",
    );
    expect(words).toContain("в форме заявки: имя, телефон.");
    expect(words).toContain("data@lesnaya.example");
  });

  it("names Seamlet as the service that only passes requests on, and no person behind it", () => {
    const words = wordsOf({
      siteTitle: "Лесная мастерская",
      operator,
      forms: [],
    });

    expect(words).toContain("обеспечивает сервис Seamlet");
    expect(words).toContain("в форме заявки: имя и контакты.");
  });
});

describe("privacyPolicyFields", () => {
  it("is a title and a text the owner edits like any other", () => {
    const schema = defineSchema({ privacy: privacyPolicyFields() });
    const text = privacyPolicyTextOf({
      siteTitle: "Сайт",
      operator,
      forms: [],
    });

    expect(defaultContent(schema)).toEqual({
      privacy: { title: "", text: [] },
    });
    expect(
      parseContent(schema, { privacy: { title: "Политика", text } }).issues,
    ).toEqual([]);
  });
});
