import {
  choices,
  collection,
  group,
  image,
  link,
  number,
  richText,
  slug,
  text,
  time,
  toggle,
  url,
} from "./fields";

// Sets of fields almost every site has, so they are edited the same way everywhere: what a page
// tells search engines and social networks, how to reach the business, when it is open, what a
// product of a catalog is. They are plain groups and collections of the usual fields; a site
// renders them as it likes.

/** What search engines and a link shared in a messenger show: one per page. */
export function seoFields(options: { readonly label?: string } = {}) {
  return group({
    label: options.label ?? "Поисковики и соцсети",
    fields: {
      title: text({ label: "Заголовок в поиске", maxLength: 60 }),
      description: text({
        label: "Описание в поиске",
        multiline: true,
        maxLength: 160,
      }),
      image: image({ label: "Картинка для ссылки в соцсетях" }),
    },
  });
}

/** How to reach the business: the phone, the address with a map, the messengers. */
export function contactsFields(options: { readonly label?: string } = {}) {
  return group({
    label: options.label ?? "Контакты",
    fields: {
      phone: link({ label: "Телефон" }),
      address: text({ label: "Адрес", multiline: true }),
      map: url({ label: "Ссылка на карту" }),
      messengers: collection({
        label: "Мессенджеры и соцсети",
        itemTitle: "link",
        item: { link: link({ label: "Ссылка" }) },
      }),
    },
  });
}

export const WEEKDAYS = [
  { value: "mon", label: "Пн" },
  { value: "tue", label: "Вт" },
  { value: "wed", label: "Ср" },
  { value: "thu", label: "Чт" },
  { value: "fri", label: "Пт" },
  { value: "sat", label: "Сб" },
  { value: "sun", label: "Вс" },
] as const;

/** When the business is open: rows of days with the same hours, «Пн–Пт 08:00–21:00». */
export function openingHoursField(options: { readonly label?: string } = {}) {
  return collection({
    label: options.label ?? "Часы работы",
    itemTitle: "days",
    item: {
      days: choices({ label: "Дни", options: WEEKDAYS }),
      opens: time({ label: "Открывается" }),
      closes: time({ label: "Закрывается" }),
      note: text({ label: "Примечание", maxLength: 40 }),
    },
  });
}

/**
 * The fields of a product of a catalog: its name and the address of its page, its photos (the first
 * is the main one), a short line for a card and a whole description for its page, the price and a
 * word about it («от», «за м²»), characteristics as pairs of a name and a value, so the owner adds a
 * property without code, the switch that hides it, and what search engines show for its page. A
 * site puts them into its collection and adds its own fields beside them:
 * `item: { ...productFields(), category: reference({ label: "Категория", collection: "categories" }) }`.
 */
export function productFields() {
  return {
    name: text({ label: "Название", maxLength: 120 }),
    slug: slug({ label: "Адрес страницы" }),
    photos: collection({
      label: "Фото",
      item: { photo: image({ label: "Фото" }) },
    }),
    summary: richText({
      label: "Строка для карточки",
      inline: true,
      maxLength: 200,
    }),
    description: richText({ label: "Описание" }),
    price: number({ label: "Цена, ₽", min: 0 }),
    priceNote: text({ label: "Уточнение цены", maxLength: 40 }),
    characteristics: collection({
      label: "Характеристики",
      itemTitle: "name",
      item: {
        name: text({ label: "Название", maxLength: 60 }),
        value: text({ label: "Значение", maxLength: 120 }),
      },
    }),
    isHidden: toggle({ label: "Скрыть с сайта" }),
    seo: seoFields(),
  };
}
