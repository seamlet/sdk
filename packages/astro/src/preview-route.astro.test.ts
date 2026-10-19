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
  const { defineSchema, text } = await import("./schema");
  const { default: TitlePage } = await import("./test-pages/TitlePage.astro");
  return {
    default: {
      schema: defineSchema({ title: text({ label: "Заголовок" }) }),
      pageAt: (rest: string | undefined) =>
        rest === undefined || rest === "menu" ? TitlePage : undefined,
      loadPublishedContent: () => Promise.resolve({ title: "Опубликовано" }),
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

  it("finds no page the site does not have", async () => {
    const response = await requestPreview("about");

    expect(response.status).toBe(404);
    expectPreviewHeaders(response);
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
