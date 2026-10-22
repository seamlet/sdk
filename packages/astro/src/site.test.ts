import { afterEach, describe, expect, it, vi } from "vitest";
import { defineSchema, text } from "./schema";
import { loadPublishedContent } from "./site";

vi.mock("virtual:seamlet/config", () => ({
  siteId: "coffee-shop",
  siteTitle: "Моя кофейня",
  cmsOrigin: "https://cms.example",
}));
vi.mock("virtual:seamlet/site", () => ({
  default: { description: { initialContent: { title: "Кофейня" } } },
}));

const schema = defineSchema({ title: text({ label: "Заголовок" }) });

function answerWith(response: Response) {
  const fetchContent = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchContent);
  return fetchContent;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadPublishedContent", () => {
  it("takes what the CMS published for the site, in the shape of its schema", async () => {
    const fetchContent = answerWith(
      Response.json({ title: "Новая кофейня", removed: true }),
    );

    await expect(loadPublishedContent(schema)).resolves.toEqual({
      title: "Новая кофейня",
    });
    expect(fetchContent).toHaveBeenCalledWith(
      new URL("https://cms.example/api/sites/coffee-shop/published"),
      expect.anything(),
    );
  });

  it("shows the initial content while the CMS does not know the site", async () => {
    answerWith(Response.json({ error: "unknown-site" }, { status: 404 }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadPublishedContent(schema)).resolves.toEqual({
      title: "Кофейня",
    });
  });

  it("stops at a CMS that fails", async () => {
    answerWith(new Response(null, { status: 500 }));

    await expect(loadPublishedContent(schema)).rejects.toThrow(
      "failed with status 500",
    );
  });

  it("stops at a CMS that does not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(new DOMException("timed out", "TimeoutError")),
      ),
    );

    await expect(loadPublishedContent(schema)).rejects.toThrow(
      "the CMS did not answer",
    );
  });
});
