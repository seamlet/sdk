import { group, richText, text } from "./fields";
import type { RequestForm } from "./request-forms";
import { richTextOf, type RichText } from "./rich-text";

// The two documents a business behind a site with forms publishes under the law on personal data
// (152-ФЗ): its policy (ст. 18.1), laid out as Роскомнадзор recommends a policy, and the visitor's
// consent, which since 1 September 2025 stands apart from any other document (ст. 9). Both are the
// site's content, pages the owner edits; the templates only start them with the business's details
// and what the site's forms ask. The business is the operator of its visitors' data; Seamlet only
// passes a request on to it, by its commission (ст. 6, ч. 3), and keeps nothing.

/** The business that collects the data: as its documents name it. */
export interface PolicyOperator {
  /** «ООО «Ромашка»» or «ИП Иванов Иван Иванович». */
  readonly name: string;
  readonly inn: string;
  readonly address: string;
  /** Where a visitor writes about their data: to withdraw the consent, to ask what is kept. */
  readonly email: string;
}

export interface PolicySource {
  readonly siteTitle: string;
  readonly operator: PolicyOperator;
  /** The site's forms, whose fields the documents name. */
  readonly forms: readonly RequestForm[];
}

/** The page of the policy on a site, which a form links to unless the site says another. */
export const PRIVACY_PAGE_PATH = "/privacy";
/** The page of the consent on a site, which a form's checkbox links to unless the site says another. */
export const CONSENT_PAGE_PATH = "/consent";

/** The working days a business has to answer a visitor about their data (ст. 14, ч. 3). */
const ANSWER_WORKING_DAYS = 10;
/** The working days the answer may wait more, when the business says why (ст. 14, ч. 3). */
const ANSWER_EXTENSION_WORKING_DAYS = 5;
/** The working days a business has to correct data a visitor shows to be wrong (ст. 21, ч. 2). */
const CORRECTION_WORKING_DAYS = 7;
/** The working days a business has to stop processing it may not do (ст. 21, ч. 3). */
const UNLAWFUL_STOP_WORKING_DAYS = 3;
/** The working days a business has to erase data it may not process and cannot fix (ст. 21, ч. 3). */
const UNLAWFUL_ERASE_WORKING_DAYS = 10;
/** The days a business has to erase data once its purpose is met or the consent withdrawn (ст. 21). */
const ERASE_DAYS = 30;

/** The policy as content: its title and its text, which the owner edits like any other text. */
export function privacyPolicyFields(options: { readonly label?: string } = {}) {
  return documentFields(
    options.label ?? "Политика обработки персональных данных",
  );
}

/** The consent as content: a document of its own, which the owner edits like any other text. */
export function privacyConsentFields(
  options: { readonly label?: string } = {},
) {
  return documentFields(
    options.label ?? "Согласие на обработку персональных данных",
  );
}

function documentFields(label: string) {
  return group({
    label,
    fields: {
      title: text({ label: "Заголовок", maxLength: 120 }),
      text: richText({ label: "Текст" }),
    },
  });
}

/**
 * A policy to start with, in the sections Роскомнадзор recommends: general provisions, purposes,
 * legal grounds, the data and whose it is, how it is processed, and how it is corrected, erased and
 * asked about.
 */
export function privacyPolicyTextOf(source: PolicySource): RichText {
  const paragraphs = [
    ...generalProvisionsOf(source),
    ...purposesOf(source),
    ...legalGroundsOf(),
    ...dataScopeOf(source),
    ...processingOf(),
    ...subjectRequestsOf(source.operator),
    ...finalProvisions(),
  ];
  return richTextOf(paragraphs.join("\n\n"));
}

/** A consent to start with: what ст. 9 asks a consent to name, as a document of its own. */
export function privacyConsentTextOf(source: PolicySource): RichText {
  const { operator, siteTitle } = source;
  const paragraphs = [
    `Отмечая согласие в форме заявки на сайте «${siteTitle}» и отправляя заявку, я свободно, своей волей и в своём интересе даю согласие на обработку моих персональных данных на следующих условиях.`,
    `1. Оператор: ${operatorDetailsOf(operator)}.`,
    `2. Цель обработки: ${PURPOSE}.`,
    `3. Персональные данные: ${sentDataOf(source.forms)}, а также адрес страницы, с которой отправлена заявка, и время её отправки.`,
    `4. Действия с данными: ${ACTIONS}. Обработка смешанная, с использованием средств автоматизации.`,
    `5. Оператор поручает приём и передачу заявок ${PROCESSOR}. Сервис передаёт заявку Оператору и не хранит её дольше, чем нужно для доставки. Данные не распространяются и не передаются за пределы Российской Федерации.`,
    `6. Согласие действует до достижения цели обработки, но не дольше одного года со дня отправки заявки. Я могу отозвать его, написав Оператору на ${operator.email}; тогда Оператор прекратит обработку и уничтожит данные в течение ${String(ERASE_DAYS)} дней, если иное не предусмотрено законом.`,
    "7. Порядок обработки моих данных и мои права описаны в политике обработки персональных данных Оператора, опубликованной на этом сайте.",
  ];
  return richTextOf(paragraphs.join("\n\n"));
}

const PURPOSE =
  "рассмотрение заявки, отправленной через форму сайта, и связь с отправителем по ней";
const ACTIONS =
  "сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передача (предоставление, доступ), блокирование, удаление, уничтожение";
const PROCESSOR =
  "сервису Seamlet (seamlet.ru), который обрабатывает данные по поручению Оператора в соответствии с частью 3 статьи 6 Федерального закона № 152-ФЗ";

function operatorDetailsOf(operator: PolicyOperator): string {
  return `${operator.name}, ИНН ${operator.inn}, адрес: ${operator.address}, электронная почта: ${operator.email}`;
}

function generalProvisionsOf({
  operator,
  siteTitle,
}: PolicySource): readonly string[] {
  return [
    "1. Общие положения",
    `1.1. Политика определяет порядок обработки и меры защиты персональных данных, которые обрабатывает ${operatorDetailsOf(operator)} (далее — Оператор), в связи с работой сайта «${siteTitle}» (далее — Сайт).`,
    "1.2. Политика составлена во исполнение пункта 2 части 1 статьи 18.1 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» (далее — Закон) с учётом рекомендаций Роскомнадзора. Понятия «персональные данные», «обработка», «оператор» и другие используются в значениях статьи 3 Закона.",
    "1.3. Оператор обязан обрабатывать персональные данные законно и справедливо, только в заявленных целях и в необходимом объёме, обеспечивать их конфиденциальность и безопасность, отвечать на обращения субъектов персональных данных и Роскомнадзора в сроки, установленные Законом.",
    "1.4. Субъект персональных данных вправе получать сведения об обработке своих данных, требовать их уточнения, блокирования или уничтожения, отозвать согласие, обжаловать действия Оператора в Роскомнадзоре или в суде.",
    "1.5. Политика опубликована на Сайте и доступна любому без ограничений.",
  ];
}

function purposesOf(source: PolicySource): readonly string[] {
  return [
    "2. Цели обработки персональных данных",
    `2.1. Цель: ${PURPOSE}.`,
    `2.2. Для этой цели: категории данных — общие персональные данные; перечень данных — ${sentDataOf(source.forms)}, адрес страницы, с которой отправлена заявка, время её отправки; категории субъектов — посетители Сайта, отправившие заявку; способ обработки — смешанный, с использованием средств автоматизации; срок обработки и хранения — до достижения цели, но не более одного года со дня отправки заявки; порядок уничтожения — удаление записей и писем с заявкой в течение ${String(ERASE_DAYS)} дней после достижения цели, истечения срока или отзыва согласия.`,
  ];
}

function legalGroundsOf(): readonly string[] {
  return [
    "3. Правовые основания обработки",
    "3.1. Конституция Российской Федерации, Гражданский кодекс Российской Федерации, Закон и принятые в соответствии с ним нормативные акты.",
    "3.2. Согласие субъекта персональных данных (пункт 1 части 1 статьи 6 Закона), которое он даёт отдельной отметкой в форме заявки перед её отправкой. Текст согласия опубликован на Сайте отдельным документом.",
  ];
}

function dataScopeOf(source: PolicySource): readonly string[] {
  return [
    "4. Объём и категории обрабатываемых данных, категории субъектов",
    `4.1. Оператор обрабатывает только данные, которые посетитель сам указывает в форме заявки: ${sentDataOf(source.forms)}, а также адрес страницы, с которой отправлена заявка, и время её отправки.`,
    "4.2. Оператор не обрабатывает специальные категории персональных данных и биометрические персональные данные и просит не указывать их в заявке.",
    "4.3. Субъекты персональных данных — посетители Сайта, отправившие заявку.",
  ];
}

function processingOf(): readonly string[] {
  return [
    "5. Порядок и условия обработки",
    `5.1. Действия с персональными данными: ${ACTIONS}.`,
    `5.2. Оператор поручает приём заявок с форм Сайта и их передачу Оператору по электронной почте ${PROCESSOR}. Сервис обязан соблюдать конфиденциальность данных, обеспечивать их безопасность по статье 19 Закона, не хранить заявку дольше, чем нужно для доставки, и не использовать данные в своих целях. Ответственность перед субъектом за действия сервиса несёт Оператор.`,
    "5.3. Запись, систематизация, накопление, хранение, уточнение и извлечение персональных данных граждан Российской Федерации ведутся с использованием баз данных, находящихся на территории Российской Федерации. Трансграничная передача не осуществляется.",
    "5.4. Оператор не распространяет персональные данные и не передаёт их третьим лицам, кроме случаев, предусмотренных законом (например, по запросу суда или уполномоченных органов).",
    "5.5. Для защиты данных Оператор принимает меры по статьям 18.1 и 19 Закона: назначает ответственного за организацию обработки, ограничивает доступ к данным кругом лиц, которым он нужен для работы, передаёт данные по защищённым каналам связи, использует средства защиты от несанкционированного доступа и уничтожает данные, когда они больше не нужны.",
    "5.6. О неправомерной или случайной передаче персональных данных, повлёкшей нарушение прав субъектов, Оператор уведомляет Роскомнадзор в сроки, установленные частью 3.1 статьи 21 Закона.",
  ];
}

function subjectRequestsOf(operator: PolicyOperator): readonly string[] {
  return [
    "6. Актуализация, исправление, удаление и уничтожение данных, ответы на запросы",
    `6.1. Запрос о своих данных, требование их уточнить, заблокировать или уничтожить, а также отзыв согласия субъект направляет на ${operator.email}. В запросе нужно указать сведения, по которым Оператор найдёт заявку (например, телефон или почту, указанные в ней), и что именно требуется.`,
    `6.2. Оператор отвечает на запрос в течение ${String(ANSWER_WORKING_DAYS)} рабочих дней. Срок может быть продлён ещё на ${String(ANSWER_EXTENSION_WORKING_DAYS)} рабочих дней, если Оператор направит мотивированное уведомление.`,
    `6.3. Неточные данные Оператор уточняет в течение ${String(CORRECTION_WORKING_DAYS)} рабочих дней после получения сведений о неточности. Неправомерную обработку Оператор прекращает в течение ${String(UNLAWFUL_STOP_WORKING_DAYS)} рабочих дней, а если её нельзя сделать правомерной — уничтожает данные в течение ${String(UNLAWFUL_ERASE_WORKING_DAYS)} рабочих дней.`,
    `6.4. При достижении цели обработки, истечении срока хранения или отзыве согласия Оператор прекращает обработку и уничтожает данные в течение ${String(ERASE_DAYS)} дней, если иное не предусмотрено законом.`,
  ];
}

function finalProvisions(): readonly string[] {
  return [
    "7. Заключительные положения",
    "7.1. Оператор может изменять Политику. Новая редакция действует со дня её публикации на Сайте.",
  ];
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
