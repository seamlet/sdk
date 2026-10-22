import { describe, expect, it } from "vitest";
import {
  defaultContent,
  defineSchema,
  parseContent,
  plainTextOf,
  privacyConsentFields,
  privacyConsentTextOf,
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
      "ООО «Лесная мастерская», ИНН 4345000000, адрес: 610000, г. Киров, ул. Лесная, д. 1",
    );
    expect(words).toContain("в форме заявки: имя, телефон, а также");
    expect(words).toContain("data@lesnaya.example");
  });

  it("names Seamlet as the service that only passes requests on, and no person behind it", () => {
    const words = wordsOf({
      siteTitle: "Лесная мастерская",
      operator,
      forms: [],
    });

    expect(words).toContain("сервису Seamlet (seamlet.ru)");
    expect(words).toContain("в форме заявки: имя и контакты, а также");
  });

  it("has the sections Роскомнадзор recommends a policy to have", () => {
    const words = wordsOf({ siteTitle: "Сайт", operator, forms: [callback] });

    const headings = [
      "1. Общие положения",
      "2. Цели обработки персональных данных",
      "3. Правовые основания обработки",
      "4. Объём и категории обрабатываемых данных, категории субъектов",
      "5. Порядок и условия обработки",
      "6. Актуализация, исправление, удаление и уничтожение данных, ответы на запросы",
    ];
    for (const heading of headings) {
      expect(words).toContain(heading);
    }
  });
});

describe("privacyConsentTextOf", () => {
  it("names the operator, the purpose, the data, who processes it by commission and how to withdraw", () => {
    const words = plainTextOf(
      privacyConsentTextOf({
        siteTitle: "Лесная мастерская",
        operator,
        forms: [callback],
      }),
    );

    expect(words).toContain(
      "1. Оператор: ООО «Лесная мастерская», ИНН 4345000000",
    );
    expect(words).toContain("2. Цель обработки: рассмотрение заявки");
    expect(words).toContain("3. Персональные данные: имя, телефон");
    expect(words).toContain("сервису Seamlet (seamlet.ru)");
    expect(words).toContain("написав Оператору на data@lesnaya.example");
  });
});

describe("privacyConsentFields", () => {
  it("is a document of its own, like the policy", () => {
    const schema = defineSchema({ consent: privacyConsentFields() });

    expect(defaultContent(schema)).toEqual({
      consent: { title: "", text: [] },
    });
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
