import { describe, expect, it } from "vitest";
import type { ProductRecord } from "../feeds/offers";
import {
  breadcrumbsOf,
  businessContactsOf,
  faqPageOf,
  localBusinessOf,
  productOf,
  structuredDataText,
} from "./structured-data";

const product: ProductRecord = {
  id: "p1",
  name: "Баня 6×4",
  slug: "banya-6x4",
  photos: [
    { photo: { src: "/photos/banya.webp", alt: "Баня" } },
    { photo: null },
  ],
  summary: [{ kind: "paragraph", spans: [{ text: "Из бруса" }] }],
  description: [],
  price: 450_000,
  priceNote: "от",
  characteristics: [],
  isHidden: false,
  seo: { title: "", description: "", image: null },
};

describe("the business", () => {
  it("is the type the site names, with what the owner filled in", () => {
    const business = localBusinessOf({
      type: "CafeOrCoffeeShop",
      name: "Моя кофейня",
      url: "https://example.ru/menu",
      telephone: "+7 900 000-00-00",
      email: " ",
      address: "Город, ул. Парковая, 1",
      images: ["/photos/hall.webp", ""],
      sameAs: ["https://vk.com/example"],
      openingHours: [
        {
          days: ["mon", "tue"],
          opens: "08:00",
          closes: "22:00",
          note: "",
        },
        { days: ["sun"], opens: null, closes: null, note: "Выходной" },
      ],
    });

    expect(business).toEqual({
      "@type": "CafeOrCoffeeShop",
      "@id": "https://example.ru/#business",
      name: "Моя кофейня",
      url: "https://example.ru/",
      telephone: "+7 900 000-00-00",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Город, ул. Парковая, 1",
      },
      image: ["https://example.ru/photos/hall.webp"],
      sameAs: ["https://vk.com/example"],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday"],
          opens: "08:00",
          closes: "22:00",
        },
      ],
    });
  });

  it("is a LocalBusiness when the site names no type", () => {
    const business = localBusinessOf({
      name: "Ромашка",
      url: "https://example.ru",
    });
    expect(business["@type"]).toBe("LocalBusiness");
  });

  it("takes the phone, the address, the map and the web links of contactsFields", () => {
    expect(
      businessContactsOf({
        phone: { text: "8 (900) 000-00-00", href: "tel:+79000000000" },
        address: "Город, ул. Парковая, 1",
        map: "https://yandex.ru/maps/-/example",
        messengers: [
          { link: { text: "ВКонтакте", href: "https://vk.com/example" } },
          { link: { text: "Почта", href: "mailto:hi@example.ru" } },
          { link: null },
        ],
      }),
    ).toEqual({
      telephone: "+79000000000",
      address: "Город, ул. Парковая, 1",
      hasMap: "https://yandex.ru/maps/-/example",
      sameAs: ["https://vk.com/example"],
    });
  });
});

describe("a product", () => {
  const url = "https://example.ru/katalog/banya-6x4";

  it("is offered at its price in rubles, with its photos and its short line", () => {
    expect(productOf(product, { url, category: "Бани" })).toEqual({
      "@type": "Product",
      "@id": `${url}#product`,
      name: "Баня 6×4",
      url,
      description: "Из бруса",
      sku: "p1",
      category: "Бани",
      image: ["https://example.ru/photos/banya.webp"],
      offers: {
        "@type": "Offer",
        price: 450_000,
        priceCurrency: "RUB",
        availability: "https://schema.org/InStock",
        url,
      },
    });
  });

  it("is a range of prices when it is sold at several", () => {
    const offers = productOf(product, {
      url,
      prices: [2500, 1900, 3400],
      availability: "MadeToOrder",
    })["offers"];
    expect(offers).toEqual({
      "@type": "AggregateOffer",
      lowPrice: 1900,
      highPrice: 3400,
      offerCount: 3,
      priceCurrency: "RUB",
      availability: "https://schema.org/MadeToOrder",
      url,
    });
  });

  it("has no offer without a price", () => {
    const offers = productOf({ ...product, price: null }, { url })["offers"];
    expect(offers).toBeUndefined();
  });
});

describe("breadcrumbs", () => {
  it("number the way from the home page", () => {
    expect(
      breadcrumbsOf([
        { name: "Главная", url: "https://example.ru/" },
        { name: "Каталог", url: "https://example.ru/katalog" },
      ]),
    ).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Главная",
          item: "https://example.ru/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Каталог",
          item: "https://example.ru/katalog",
        },
      ],
    });
  });
});

describe("the questions of a page", () => {
  it("are the questions with an answer, a formatted one in its words", () => {
    expect(
      faqPageOf([
        {
          question: "Сколько строите?",
          answer: [
            { kind: "paragraph", spans: [{ text: "Месяц", bold: true }] },
          ],
        },
        { question: "Без ответа?", answer: "" },
      ]),
    ).toEqual({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Сколько строите?",
          acceptedAnswer: { "@type": "Answer", text: "Месяц" },
        },
      ],
    });
  });

  it("are no FAQ when none is answered", () => {
    expect(faqPageOf([{ question: "Вопрос?", answer: " " }])).toBeUndefined();
  });
});

describe("the text of the structured data", () => {
  const business = localBusinessOf({
    name: "Ромашка",
    url: "https://example.ru",
  });

  it("gives one thing its context", () => {
    expect(JSON.parse(structuredDataText(business) ?? "")).toEqual({
      "@context": "https://schema.org",
      ...business,
    });
  });

  it("puts several things in one graph and leaves out the missing ones", () => {
    const faq = faqPageOf([{ question: "Вопрос?", answer: "Ответ" }]);
    expect(
      JSON.parse(structuredDataText([business, undefined, faq]) ?? ""),
    ).toEqual({ "@context": "https://schema.org", "@graph": [business, faq] });
  });

  it("is nothing when there is nothing to say", () => {
    expect(structuredDataText([undefined])).toBeUndefined();
  });

  it("can never close its script element, and reads back the same words", () => {
    const name = "</script><script>alert(1)</script> & \u2028";
    const text = structuredDataText(
      localBusinessOf({ name, url: "https://example.ru" }),
    );

    expect(text).not.toMatch(/[<>&\u2028]/u);
    expect((JSON.parse(text ?? "") as { name: string }).name).toBe(name);
  });
});
