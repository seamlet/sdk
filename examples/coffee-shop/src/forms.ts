import {
  requestForm,
  requestLongText,
  requestPhone,
  requestText,
} from "@seamlet/astro/schema";

// The forms the coffee shop's guests send requests with: the CMS passes them on to the coffee shop
// by mail. A guest consents with the coffee shop's consent and policy, its pages
// `/consent` and `/privacy`.

export const tableForm = requestForm({
  id: "table",
  title: "Бронь столика",
  fields: {
    name: requestText({ label: "Имя", required: true }),
    phone: requestPhone({ label: "Телефон", required: true }),
    time: requestText({ label: "Когда придёте", maxLength: 60 }),
    comment: requestLongText({ label: "Пожелания", maxLength: 500 }),
  },
});
