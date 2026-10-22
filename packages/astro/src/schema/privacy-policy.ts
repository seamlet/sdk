import { group, richText, text } from "./fields";
import type { RequestForm } from "./request-forms";
import { richTextOf, type RichText } from "./rich-text";

// The policy of the business behind a site with forms: what the law on personal data (152-ФЗ)
// asks a business to publish when its site collects names and phones. It is the site's content,
// one more page the owner edits; the template only starts it with the business's details and what
// the site's forms ask. The business is the operator of its visitors' data; Seamlet only passes a
// request on to it, by its commission, and keeps nothing.

/** The business that collects the data: as its documents name it. */
export interface PolicyOperator {
  /** «ООО «Лесная мастерская»» or «ИП Иванов Иван Иванович». */
  readonly name: string;
  readonly inn: string;
  readonly address: string;
  /** Where a visitor writes about their data: to withdraw the consent, to ask what is kept. */
  readonly email: string;
}

export interface PolicySource {
  readonly siteTitle: string;
  readonly operator: PolicyOperator;
  /** The site's forms, whose fields the policy names. */
  readonly forms: readonly RequestForm[];
}

/** The page of the policy on a site, which a form's consent links to unless the site says another. */
export const PRIVACY_PAGE_PATH = "/privacy";

/** The days a business has to stop and erase after a consent is withdrawn (152-ФЗ, ст. 21). */
const WITHDRAWAL_DAYS = 30;
/** The working days a business has to answer a visitor about their data (152-ФЗ, ст. 14). */
const ANSWER_WORKING_DAYS = 10;

/** The policy as content: its title and its text, which the owner edits like any other text. */
export function privacyPolicyFields(options: { readonly label?: string } = {}) {
  return group({
    label: options.label ?? "Политика обработки персональных данных",
    fields: {
      title: text({ label: "Заголовок", maxLength: 120 }),
      text: richText({ label: "Текст" }),
    },
  });
}

/** A policy to start with, made from the business's details and what the site's forms ask. */
export function privacyPolicyTextOf(source: PolicySource): RichText {
  const { operator, siteTitle } = source;
  const operatorName = `${operator.name} (ИНН ${operator.inn}, адрес: ${operator.address})`;
  const sentData = sentDataOf(source.forms);
  return richTextOf(
    [
      "1. Общие положения",
      `1.1. Эта политика описывает, как ${operatorName} — далее «Оператор» — обрабатывает персональные данные посетителей сайта «${siteTitle}», которые отправляют заявки через его формы.`,
      "1.2. Политика составлена по Федеральному закону от 27.07.2006 № 152-ФЗ «О персональных данных».",
      "2. Какие данные обрабатываются",
      `2.1. Сведения, которые посетитель сам указывает в форме заявки: ${sentData}.`,
      "2.2. Адрес страницы, с которой отправлена заявка, и время её отправки.",
      "2.3. Оператор не обрабатывает специальные категории персональных данных и биометрические данные и просит не указывать их в заявке.",
      "3. Цель, основание и согласие",
      "3.1. Цель — рассмотреть заявку посетителя и связаться с ним по ней.",
      "3.2. Основание — согласие посетителя. Отмечая согласие в форме перед отправкой заявки, посетитель свободно, своей волей и в своём интересе даёт Оператору согласие на обработку указанных данных на условиях этой политики.",
      "4. Как обрабатываются данные",
      "4.1. Оператор собирает, записывает, хранит, использует, удаляет и уничтожает данные с использованием средств автоматизации.",
      "4.2. Приём заявок с форм сайта по поручению Оператора обеспечивает сервис Seamlet: он передаёт заявку Оператору и не хранит её дольше, чем нужно для доставки, соблюдая конфиденциальность и требования статьи 19 Федерального закона № 152-ФЗ. Данные хранятся в Российской Федерации.",
      "4.3. Оператор не распространяет данные и не передаёт их третьим лицам, кроме случаев, предусмотренных законом.",
      "5. Сроки",
      "5.1. Данные хранятся, пока это нужно для рассмотрения заявки, но не дольше одного года со дня её отправки, после чего удаляются.",
      `5.2. Посетитель может отозвать согласие, написав Оператору на ${operator.email}. Тогда Оператор прекратит обработку и удалит данные в течение ${String(WITHDRAWAL_DAYS)} дней, если иное не предусмотрено законом.`,
      "6. Права посетителя",
      `6.1. Посетитель вправе узнать, как обрабатываются его данные, потребовать уточнить, заблокировать или удалить их, отозвать согласие и обжаловать действия Оператора в Роскомнадзоре или в суде. Для этого достаточно написать Оператору на ${operator.email}; Оператор отвечает в течение ${String(ANSWER_WORKING_DAYS)} рабочих дней.`,
      "7. Изменения политики",
      "7.1. Оператор может изменять политику. Новая редакция действует с момента публикации на этой странице.",
    ].join("\n\n"),
  );
}

/** What the forms ask, as a text says it, each once: «имя, телефон, комментарий». */
function sentDataOf(forms: readonly RequestForm[]): string {
  const labels = forms.flatMap((form) =>
    Object.values(form.fields).map((field) => lowercaseFirst(field.label)),
  );
  const unique = [...new Set(labels)];
  return unique.length === 0 ? "имя и контакты" : unique.join(", ");
}

function lowercaseFirst(label: string): string {
  return `${label.charAt(0).toLocaleLowerCase("ru")}${label.slice(1)}`;
}
