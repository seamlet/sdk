import {
  privacyConsentTextOf,
  privacyPolicyTextOf,
  richTextOf,
  type PolicySource,
} from "@seamlet/astro/schema";
import { tableForm } from "./forms";
import type { CoffeeShopContent } from "./schema";

// A made-up coffee shop: the content the demo starts with.

/** The business behind the site, made up too, whose documents of personal data start the content. */
const policySource: PolicySource = {
  siteTitle: "Моя кофейня",
  operator: {
    name: "ИП Иванов Иван Иванович",
    inn: "000000000000",
    address: "г. Москва, ул. Примерная, д. 1",
    email: "hello@example.ru",
  },
  forms: [tableForm],
};

export const coffeeShopInitialContent: CoffeeShopContent = {
  hero: {
    title: "Моя кофейня",
    subtitle: richTextOf(
      "Обжариваем зерно сами и варим кофе без спешки: эспрессо, фильтр и сезонные напитки.",
    ),
    photo: {
      src: "/cup.svg",
      alt: "Чашка капучино на блюдце, над ней поднимается пар",
    },
  },
  privacy: {
    title: "Политика обработки персональных данных",
    text: privacyPolicyTextOf(policySource),
  },
  consent: {
    title: "Согласие на обработку персональных данных",
    text: privacyConsentTextOf(policySource),
  },
  menu: [
    {
      name: "Эспрессо",
      slug: "espresso",
      description: richTextOf("Двойная порция, плотный и сладкий."),
      price: 150,
    },
    {
      name: "Капучино",
      slug: "kapuchino",
      description: richTextOf("Эспрессо и молоко, взбитое в бархатную пену."),
      price: 220,
    },
    {
      name: "Фильтр-кофе",
      slug: "filtr-kofe",
      description: richTextOf("Кофе недели, заваренное в воронке."),
      price: 190,
    },
    {
      name: "Раф с кардамоном",
      slug: "raf-s-kardamonom",
      description: richTextOf("Сливки, ваниль и щепотка кардамона."),
      price: 260,
    },
  ],
  menuPage: {
    title: "Меню",
    intro: [
      {
        kind: "paragraph",
        spans: [
          { text: "Готовим на зерне " },
          { text: "собственной обжарки", bold: true },
          { text: ". Молоко — коровье или овсяное, без доплаты." },
        ],
      },
    ],
  },
  event: {
    title: "Дегустация кофе из Эфиопии",
    date: "2026-10-24",
    signup: { text: "Записаться", href: "tel:+70000000000" },
  },
  contacts: {
    address: "ул. Примерная, 12",
    phone: "+7 (000) 000-00-00",
    hours: "Ежедневно с 8:00 до 22:00",
  },
  links: [
    { link: { text: "Telegram", href: "https://example.com/telegram" } },
    { link: { text: "ВКонтакте", href: "https://example.com/vk" } },
  ],
};
