import {
  collection,
  contactsFields,
  defineSchema,
  group,
  image,
  number,
  seoFields,
  text,
  type ContentOf,
} from "@seamlet/astro/schema";

// What the owner edits in the CMS. The one description of the content: the CMS builds its form
// from it, and the page takes the types of its props from it.
export const schema = defineSchema({
  hero: group({
    label: "Первый экран",
    fields: {
      title: text({ label: "Заголовок", maxLength: 60 }),
      lead: text({ label: "Подзаголовок", multiline: true, maxLength: 200 }),
      photo: image({ label: "Фото" }),
    },
  }),
  menu: collection({
    label: "Меню",
    itemTitle: "name",
    item: {
      name: text({ label: "Название", maxLength: 60 }),
      description: text({ label: "Описание", multiline: true, maxLength: 160 }),
      price: number({ label: "Цена, ₽", min: 0 }),
    },
  }),
  contacts: contactsFields(),
  seo: seoFields(),
});

export type Content = ContentOf<typeof schema>;

/** What the site shows, and the CMS edits, until the first publication. */
export const initialContent: Content = {
  hero: {
    title: "Моя кофейня",
    lead: "Обжариваем зерно сами и варим кофе без спешки: эспрессо, фильтр и сезонные напитки.",
    photo: null,
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
      description: "Кофе недели, заваренное в воронке.",
      price: 190,
    },
  ],
  contacts: {
    phone: { text: "+7 (495) 000-00-00", href: "tel:+74950000000" },
    address: "Москва, ул. Примерная, д. 1",
    map: null,
    messengers: [],
  },
  seo: {
    title: "Моя кофейня: свежая обжарка и завтраки",
    description:
      "Кофе из зерна собственной обжарки, завтраки и десерты. Меню, цены и как нас найти.",
    image: null,
  },
};
