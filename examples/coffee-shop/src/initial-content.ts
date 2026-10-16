import type { CoffeeShopContent } from "./schema";

// A made-up coffee shop: the content the demo starts with.
export const coffeeShopInitialContent: CoffeeShopContent = {
  hero: {
    title: "Кофейня «Зерно»",
    subtitle:
      "Обжариваем зерно сами и варим кофе без спешки: эспрессо, фильтр и сезонные напитки.",
    photo: {
      src: "/cup.svg",
      alt: "Чашка капучино на блюдце, над ней поднимается пар",
    },
  },
  menu: [
    {
      name: "Эспрессо",
      description: "Двойная порция, плотный и сладкий.",
      price: 150,
    },
    {
      name: "Капучино",
      description: "Эспрессо и молоко, взбитое в бархатную пену.",
      price: 220,
    },
    {
      name: "Фильтр-кофе",
      description: "Зерно недели, заваренное в воронке.",
      price: 190,
    },
    {
      name: "Раф с кардамоном",
      description: "Сливки, ваниль и щепотка кардамона.",
      price: 260,
    },
  ],
  menuPage: {
    title: "Меню",
    intro:
      "Готовим на зерне собственной обжарки. Молоко — коровье или овсяное, без доплаты.",
  },
  event: {
    title: "Дегустация кофе из Эфиопии",
    date: "2026-10-24",
    signup: { text: "Записаться", href: "tel:+70000000000" },
  },
  contacts: {
    address: "ул. Садовая, 12",
    phone: "+7 (000) 000-00-00",
    hours: "Ежедневно с 8:00 до 22:00",
  },
  links: [
    { link: { text: "Telegram", href: "https://example.com/telegram" } },
    { link: { text: "ВКонтакте", href: "https://example.com/vk" } },
  ],
};
