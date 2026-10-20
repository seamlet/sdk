import {
  collection,
  date,
  defineSchema,
  group,
  image,
  link,
  number,
  richText,
  text,
  type ContentOf,
} from "@seamlet/astro/schema";

// What the owner of the coffee shop can edit. The one description of the content: the CMS builds
// its form from it, and the page below takes the types of its props from it. Prose is formatted
// text (bold, italic, links); headings, names, buttons and contacts are plain text, so the owner
// meets one rule: a paragraph can be formatted, everything else is typed as it is.
export const coffeeShopSchema = defineSchema({
  hero: group({
    label: "Первый экран",
    fields: {
      title: text({ label: "Заголовок", maxLength: 60 }),
      subtitle: richText({
        label: "Подзаголовок",
        inline: true,
        maxLength: 200,
      }),
      photo: image({ label: "Фото" }),
    },
  }),
  menu: collection({
    label: "Меню",
    itemTitle: "name",
    item: {
      name: text({ label: "Название", maxLength: 40 }),
      description: richText({
        label: "Описание",
        inline: true,
        maxLength: 160,
      }),
      price: number({ label: "Цена, ₽", min: 0, max: 100_000 }),
    },
  }),
  menuPage: group({
    label: "Страница «Меню»",
    fields: {
      title: text({ label: "Заголовок", maxLength: 60 }),
      intro: richText({ label: "Вступление", maxLength: 300 }),
    },
  }),
  event: group({
    label: "Ближайшее событие",
    fields: {
      title: text({ label: "Название", maxLength: 80 }),
      date: date({ label: "Дата" }),
      signup: link({ label: "Кнопка записи" }),
    },
  }),
  contacts: group({
    label: "Контакты",
    fields: {
      address: text({ label: "Адрес", maxLength: 120 }),
      phone: text({ label: "Телефон", maxLength: 30 }),
      hours: text({ label: "Часы работы", maxLength: 60 }),
    },
  }),
  links: collection({
    label: "Ссылки в подвале",
    itemTitle: "link",
    item: { link: link({ label: "Ссылка" }) },
  }),
});

export type CoffeeShopContent = ContentOf<typeof coffeeShopSchema>;
