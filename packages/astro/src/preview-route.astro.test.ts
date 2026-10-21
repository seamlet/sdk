import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreviewRoute from "../routes/preview.astro";
import { MAX_DRAFT_BYTES } from "./preview-requests";

vi.mock("virtual:seamlet/config", () => ({
  siteId: "coffee-shop",
  siteTitle: "Кофейня «Зерно»",
  cmsOrigin: "https://cms.example",
}));
// A mock is hoisted above the imports: it takes what it needs itself.
vi.mock("virtual:seamlet/site", async () => {
  const { collection, defineSchema, recordPages, slug, text } =
    await import("./schema");
  const { defineSeamletSite } = await import("./site");
  const { default: TitlePage } = await import("./test-pages/TitlePage.astro");
  const { default: RecordPage } = await import("./test-pages/RecordPage.astro");
  const schema = defineSchema({
    title: text({ label: "Заголовок" }),
    menu: collection({
      label: "Меню",
      item: {
        name: text({ label: "Название" }),
        slug: slug({ label: "Адрес" }),
      },
    }),
  });
  const latte = { id: "d1", name: "Латте", slug: "latte" };
  const site = defineSeamletSite({
    schema,
    initialContent: { title: "Зерно", menu: [latte] },
    pages: {
      "/": { title: "Главная", component: TitlePage },
      "/menu": { title: "Меню", component: TitlePage },
    },
    recordPages: [
      {
        pages: recordPages(schema, {
          collection: "menu",
          path: "/menu/[record]",
        }),
        component: RecordPage,
      },
    ],
  });
  const published = {
    title: "Опубликовано",
    menu: [{ id: "d0", name: "Раф", slug: "" }, latte],
  };
  return {
    default: {
      ...site,
      loadPublishedContent: () => Promise.resolve(published),
    },
  };
});

const PREVIEW_HEADERS = {
  "content-security-policy": "frame-ancestors https://cms.example",
  "x-robots-tag": "noindex",
  "cache-control": "no-store",
};

let container: AstroContainer;

beforeEach(async () => {
  container = await AstroContainer.create();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function requestPreview(
  page: string | undefined,
  init?: RequestInit,
): Promise<Response> {
  const path = page === undefined ? "/preview" : `/preview/${page}`;
  return container.renderToResponse(PreviewRoute, {
    request: new Request(`https://site.example${path}`, init),
    params: { page },
  });
}

function postDraft(body: string, type = "application/json"): RequestInit {
  return { method: "POST", headers: { "Content-Type": type }, body };
}

function expectPreviewHeaders(response: Response): void {
  for (const [name, value] of Object.entries(PREVIEW_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
}

describe("the preview route", () => {
  it("shows the published content to the CMS's editor alone", async () => {
    const response = await requestPreview(undefined);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<h1>Опубликовано</h1>");
    expectPreviewHeaders(response);
  });

  it("shows the editor's draft, never kept", async () => {
    const response = await requestPreview(
      "menu",
      postDraft('{"title":"Черновик"}'),
    );

    expect(await response.text()).toContain("<h1>Черновик</h1>");
    expectPreviewHeaders(response);
  });

  it("shows a draft with values of the wrong kind with their defaults", async () => {
    const response = await requestPreview(undefined, postDraft('{"title":3}'));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<h1></h1>");
  });

  it("shows the page of a record at its slug, and at its id for the editor", async () => {
    const atSlug = await requestPreview("menu/latte");
    const atId = await requestPreview("menu/d1");

    expect(await atSlug.text()).toContain("<h1>Латте</h1>");
    expect(await atId.text()).toContain("<p>Опубликовано, 1</p>");
  });

  it("shows the page of a record the editor added blank, until its draft renders", async () => {
    const added = await requestPreview("menu/new-drink");
    const rendered = await requestPreview(
      "menu/new-drink",
      postDraft(
        '{"title":"Черновик","menu":[{"id":"new-drink","name":"Какао","slug":""}]}',
      ),
    );

    expect(added.status).toBe(200);
    expect(await added.text()).toContain("<h1></h1>");
    expect(await rendered.text()).toContain("<h1>Какао</h1>");
  });

  it("finds no page of a record the draft has removed", async () => {
    const response = await requestPreview(
      "menu/latte",
      postDraft('{"title":"Черновик","menu":[]}'),
    );

    expect(response.status).toBe(404);
    expectPreviewHeaders(response);
  });

  it("finds no page the site does not have", async () => {
    const response = await requestPreview("about");
    const notAnId = await requestPreview("menu/Латте");
    const unread = await requestPreview(
      "about",
      postDraft("not JSON", "text/plain"),
    );

    expect(response.status).toBe(404);
    expectPreviewHeaders(response);
    expect(notAnId.status).toBe(404);
    // Answered before the draft is read: an address of no page is refused as such.
    expect(unread.status).toBe(404);
  });

  it("refuses a draft that is not JSON or is too big, with the same headers", async () => {
    const wrongType = await requestPreview(
      undefined,
      postDraft('{"title":"x"}', "text/plain"),
    );
    const tooBig = await requestPreview(
      undefined,
      postDraft(`"${"a".repeat(MAX_DRAFT_BYTES)}"`),
    );

    expect(wrongType.status).toBe(415);
    expectPreviewHeaders(wrongType);
    expect(tooBig.status).toBe(413);
    expectPreviewHeaders(tooBig);
  });
});
