// The form of requests as a site renders it, sent the way a visitor's browser sends it: rendered with
// Astro's container in Node, then put in a jsdom window whose globals the package's script uses.
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RequestForm from "../components/RequestForm.astro";
import { connectRequestForms } from "./request-sending";
import {
  requestChoice,
  requestForm,
  requestLongText,
  requestPhone,
  requestText,
  REQUEST_SENT_EVENT,
  REQUEST_SEND_EVENT,
  REQUEST_FAILED_EVENT,
  type RequestFailedDetail,
  type RequestSentDetail,
} from "./schema";

vi.mock("virtual:seamlet/config", () => ({
  siteId: "lesnaya",
  siteTitle: "Лесная мастерская",
  cmsOrigin: "https://cms.example",
}));

const estimate = requestForm({
  id: "estimate",
  title: "Рассчитать стоимость",
  fields: {
    name: requestText({ label: "Имя" }),
    phone: requestPhone({ label: "Телефон", required: true }),
    size: requestChoice({ label: "Размер", options: ["6×4", "6×6"] }),
    comment: requestLongText({ label: "Комментарий" }),
  },
});

/** The names the script takes from the browser's global scope. */
const browserGlobals = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLFormElement",
  "HTMLButtonElement",
  "FormData",
  "CustomEvent",
  "Event",
] as const;

let markup = "";
let window: JSDOM["window"];
const fetchRequest = vi.fn<typeof fetch>();

async function renderForm(): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(RequestForm, {
    props: { form: estimate, submitLabel: "Рассчитать" },
    request: new Request("https://lesnaya.example/catalog/banya"),
  });
}

beforeEach(async () => {
  markup ||= await renderForm();
  const dom = new JSDOM(`<main>${markup}</main>`, {
    url: "https://lesnaya.example/catalog/banya",
  });
  window = dom.window;
  for (const name of browserGlobals) vi.stubGlobal(name, window[name]);
  vi.stubGlobal("fetch", fetchRequest);
  fetchRequest.mockReset();
  connectRequestForms(window.document, { isPreview: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function element(selector: string): HTMLElement {
  const found = window.document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`No ${selector}`);
  return found;
}

const form = () => element("form") as HTMLFormElement;
const control = (name: string) =>
  element(`[name="${name}"]`) as HTMLInputElement;
const issue = (name: string) => element(`[data-seamlet-issue="${name}"]`);

function fill(name: string, value: string): void {
  control(name).value = value;
}

function submit(): void {
  form().dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
}

/** The fields a visitor must fill in, filled in, and the consent given. */
function fillRequest(): void {
  fill("phone", "89123456789");
  control("seamlet-consent").checked = true;
}

function listenToFailures() {
  const failed = vi.fn<(detail: RequestFailedDetail) => void>();
  window.document.addEventListener(REQUEST_FAILED_EVENT, (event) => {
    failed((event as CustomEvent<RequestFailedDetail>).detail);
  });
  return failed;
}

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Lets the sending finish: the answer and its body are read on later turns. */
async function settled(): Promise<void> {
  await vi.waitFor(() => {
    expect(form().dataset["seamletState"]).not.toBe("sending");
  });
}

describe("the form of requests", () => {
  it("posts to the CMS without a script, from the page it stands on", () => {
    expect(form().action).toBe(
      "https://cms.example/api/sites/lesnaya/requests",
    );
    expect(form().method).toBe("post");
    expect(control("seamlet-form").value).toBe("estimate");
    expect(control("seamlet-page").value).toBe("/catalog/banya");
    expect(control("phone").type).toBe("tel");
    expect(control("phone").required).toBe(true);
    expect(control("name").required).toBe(false);
  });

  it("asks for consent with a checkbox of its own, never checked beforehand", () => {
    const consent = control("seamlet-consent");

    expect(consent.type).toBe("checkbox");
    expect(consent.checked).toBe(false);
    const links = [
      ...window.document.querySelectorAll(".seamlet-form-consent a"),
    ];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/consent",
      "/privacy",
    ]);
  });

  it("says what to fix under every field and sends nothing", () => {
    fill("phone", "позвоните");
    submit();

    expect(issue("phone").textContent).toBe("Проверьте номер телефона");
    expect(issue("phone").hidden).toBe(false);
    expect(control("phone").getAttribute("aria-invalid")).toBe("true");
    expect(issue("seamlet-consent").textContent).toBe(
      "Отметьте согласие на обработку персональных данных",
    );
    expect(issue("name").hidden).toBe(true);
    expect(window.document.activeElement).toBe(control("phone"));
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("sends the request in place and tells the site's code once it is kept", async () => {
    const sent = vi.fn<(detail: RequestSentDetail) => void>();
    window.document.addEventListener(REQUEST_SENT_EVENT, (event) => {
      sent((event as CustomEvent<RequestSentDetail>).detail);
    });
    fetchRequest.mockResolvedValue(
      answer(201, { status: "received", id: "r1" }),
    );
    fill("name", "Анна");
    fill("phone", "+7 912 345-67-89");
    control("seamlet-consent").checked = true;

    submit();
    await settled();

    const [url, init] = fetchRequest.mock.calls[0] ?? [];
    expect(url).toBe("https://cms.example/api/sites/lesnaya/requests");
    const body = typeof init?.body === "string" ? init.body : "";
    expect(JSON.parse(body)).toEqual({
      "seamlet-form": "estimate",
      "seamlet-page": "/catalog/banya",
      name: "Анна",
      phone: "+7 912 345-67-89",
      size: "",
      comment: "",
      "seamlet-check": "",
      "seamlet-consent": "on",
    });
    expect(element("[data-seamlet-sent]").textContent).toBe(
      "Заявка отправлена. Ответим по контактам, которые вы оставили.",
    );
    expect(window.document.activeElement).toBe(element("[data-seamlet-sent]"));
    expect(control("name").value).toBe("");
    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({ form: "estimate", id: "r1" }),
    );
  });

  it("lets the site's code send the request its own way", () => {
    window.document.addEventListener(REQUEST_SEND_EVENT, (event) => {
      event.preventDefault();
    });
    fill("phone", "89123456789");
    control("seamlet-consent").checked = true;

    submit();

    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("shows the fields the CMS could not take, the words still in the form", async () => {
    const failed = vi.fn<(detail: RequestFailedDetail) => void>();
    window.document.addEventListener(REQUEST_FAILED_EVENT, (event) => {
      failed((event as CustomEvent<RequestFailedDetail>).detail);
    });
    fetchRequest.mockResolvedValue(
      answer(422, {
        status: "invalid",
        issues: [{ field: "size", code: "unknown-option" }],
      }),
    );
    fill("phone", "89123456789");
    control("seamlet-consent").checked = true;

    submit();
    await settled();

    expect(issue("size").textContent).toBe("Выберите вариант из списка");
    expect(element("[data-seamlet-failed]").textContent).not.toBe("");
    expect(window.document.activeElement).toBe(control("size"));
    expect(control("phone").value).toBe("89123456789");
    expect(failed).toHaveBeenCalledWith({
      form: "estimate",
      reason: "invalid",
      issues: [{ field: "size", code: "unknown-option" }],
    });
  });

  it("says a business that takes no requests yet is closed", async () => {
    const failed = vi.fn<(detail: RequestFailedDetail) => void>();
    window.document.addEventListener(REQUEST_FAILED_EVENT, (event) => {
      failed((event as CustomEvent<RequestFailedDetail>).detail);
    });
    fetchRequest.mockResolvedValue(answer(409, { status: "closed" }));
    fill("phone", "89123456789");
    control("seamlet-consent").checked = true;

    submit();
    await settled();

    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "closed" }),
    );
  });

  it("posts the form itself when the page's policy stops the request", async () => {
    const posted = vi.spyOn(window.HTMLFormElement.prototype, "submit");
    posted.mockImplementation(() => undefined);
    fetchRequest.mockImplementation(() => {
      const violation = new window.Event("securitypolicyviolation");
      Object.assign(violation, {
        blockedURI: "https://cms.example/api/sites/lesnaya/requests",
      });
      window.document.dispatchEvent(violation);
      return Promise.reject(new TypeError("Refused to connect"));
    });
    fillRequest();

    submit();
    await vi.waitFor(() => {
      expect(posted).toHaveBeenCalled();
    });
  });

  it("says a CMS that cannot be reached is unavailable, and posts nothing again", async () => {
    const posted = vi.spyOn(window.HTMLFormElement.prototype, "submit");
    const failed = listenToFailures();
    fetchRequest.mockRejectedValue(new TypeError("Failed to fetch"));
    fillRequest();

    submit();
    await settled();

    expect(posted).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "unavailable" }),
    );
  });

  it.each([
    [429, "too-many"],
    [500, "unavailable"],
  ])("tells a refusal %d as %s", async (status, reason) => {
    const failed = listenToFailures();
    fetchRequest.mockResolvedValue(answer(status, {}));
    fillRequest();

    submit();
    await settled();

    expect(failed).toHaveBeenCalledWith(expect.objectContaining({ reason }));
  });

  it("sends a request once while it is being sent", async () => {
    fetchRequest.mockReturnValue(new Promise<Response>(() => undefined));
    fillRequest();

    submit();
    submit();
    await Promise.resolve();

    expect(fetchRequest).toHaveBeenCalledTimes(1);
  });

  it("sends to the CMS even when a field is named as the form's own property", async () => {
    const odd = requestForm({
      id: "odd",
      title: "Заявка",
      fields: { action: requestText({ label: "Что сделать", required: true }) },
    });
    const container = await AstroContainer.create();
    const oddMarkup = await container.renderToString(RequestForm, {
      props: { form: odd },
    });
    window.document.body.innerHTML = oddMarkup;
    connectRequestForms(window.document, { isPreview: false });
    fetchRequest.mockResolvedValue(
      answer(201, { status: "received", id: "r2" }),
    );
    fill("action", "Перезвонить");
    control("seamlet-consent").checked = true;

    submit();
    await settled();

    expect(fetchRequest.mock.calls[0]?.[0]).toBe(
      "https://cms.example/api/sites/lesnaya/requests",
    );
    expect(control("action").value).toBe("");
  });

  it("keeps a form of the editor's preview from sending", () => {
    const preview = new JSDOM(markup);
    connectRequestForms(preview.window.document, { isPreview: true });
    const previewForm = preview.window.document.querySelector("form");
    const event = new preview.window.Event("submit", { cancelable: true });

    previewForm?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(fetchRequest).not.toHaveBeenCalled();
  });
});
