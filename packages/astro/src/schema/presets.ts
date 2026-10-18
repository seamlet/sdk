import {
  choices,
  collection,
  group,
  image,
  link,
  text,
  time,
  url,
} from "./fields";

// Sets of fields almost every site has, so they are edited the same way everywhere: what a page
// tells search engines and social networks, how to reach the business, when it is open. They are
// plain groups and collections of the usual fields; a site renders them as it likes.

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
      image: image({ label: "Картинка для соцсетей" }),
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
    itemTitle: "note",
    item: {
      days: choices({ label: "Дни", options: WEEKDAYS }),
      opens: time({ label: "Открывается" }),
      closes: time({ label: "Закрывается" }),
      note: text({ label: "Подпись", maxLength: 40 }),
    },
  });
}
