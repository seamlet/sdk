import { afterEach, describe, expect, it, vi } from "vitest";
import { defineSchema, text } from "./schema";
import { loadPublishedContent } from "./site";

const copy = vi.hoisted(() => ({
  contentCopyText: undefined as string | undefined,
  isContentCopyOnly: false,
  copiedMediaDirectory: "/nowhere/seamlet/media",
}));

vi.mock("virtual:seamlet/content-copy", () => copy);
vi.mock("virtual:seamlet/config", () => ({
  siteId: "coffee-shop",
  siteTitle: "Моя кофейня",
  cmsOrigin: "https://cms.example",
  ownerToken: undefined,
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
  copy.contentCopyText = undefined;
  copy.isContentCopyOnly = false;
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

const copyOf = (site: string, content: unknown) =>
  JSON.stringify({
    site,
    version: 4,
    publishedAt: "2026-11-01T10:00:00.000Z",
    content,
  });

describe("loadPublishedContent with a copy of the content in the repository", () => {
  const keepCopy = (text: string) => {
    copy.contentCopyText = text;
  };

  it("builds from the copy when the CMS fails, saying so once", async () => {
    keepCopy(copyOf("coffee-shop", { title: "Из копии", removed: true }));
    answerWith(new Response(null, { status: 503 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadPublishedContent(schema)).resolves.toEqual({
      title: "Из копии",
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "built from the copy seamlet/content.json published on 2026-11-01T10:00:00.000Z",
      ),
    );
  });

  it("builds from the copy when the CMS does not answer", async () => {
    keepCopy(copyOf("coffee-shop", { title: "Из копии" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("fetch failed"))),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadPublishedContent(schema)).resolves.toEqual({
      title: "Из копии",
    });
  });

  it("prefers what the CMS published while it answers", async () => {
    keepCopy(copyOf("coffee-shop", { title: "Из копии" }));
    answerWith(Response.json({ title: "Новая кофейня" }));

    await expect(loadPublishedContent(schema)).resolves.toEqual({
      title: "Новая кофейня",
    });
  });

  it("keeps the initial content for a site the CMS does not know", async () => {
    keepCopy(copyOf("coffee-shop", { title: "Из копии" }));
    answerWith(Response.json({ error: "unknown-site" }, { status: 404 }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(loadPublishedContent(schema)).resolves.toEqual({
      title: "Кофейня",
    });
  });

  it("still stops at a refusal that points at a wrong address or token", async () => {
    keepCopy(copyOf("coffee-shop", { title: "Из копии" }));
    answerWith(new Response(null, { status: 403 }));

    await expect(loadPublishedContent(schema)).rejects.toThrow(
      "failed with status 403",
    );
  });

  it("stops with the CMS's problem when a CMS that fails has no copy", async () => {
    answerWith(new Response(null, { status: 500 }));

    await expect(loadPublishedContent(schema)).rejects.toThrow(
      "failed with status 500",
    );
  });

  it("stops, naming the file, at a copy that cannot be read", async () => {
    answerWith(new Response(null, { status: 500 }));

    keepCopy("{");
    await expect(loadPublishedContent(schema)).rejects.toThrow(
      "seamlet/content.json is not JSON",
    );

    keepCopy(copyOf("another-site", { title: "Чужая" }));
    await expect(loadPublishedContent(schema)).rejects.toThrow(
      'is the copy of "another-site", not of "coffee-shop"',
    );

    keepCopy(copyOf("coffee-shop", "text"));
    await expect(loadPublishedContent(schema)).rejects.toThrow(
      "has no `content` object",
    );
  });

  it("warns of the fields of a copy that do not fit the schema", async () => {
    keepCopy(copyOf("coffee-shop", { title: 5 }));
    answerWith(new Response(null, { status: 500 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadPublishedContent(schema);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "does not fit the schema at title (invalid-type)",
      ),
    );
  });

  describe("with SEAMLET_CONTENT=copy", () => {
    it("takes the copy and never asks the CMS", async () => {
      copy.isContentCopyOnly = true;
      keepCopy(copyOf("coffee-shop", { title: "Из копии" }));
      const fetchContent = answerWith(Response.json({ title: "Новая" }));
      vi.spyOn(console, "info").mockImplementation(() => undefined);

      await expect(loadPublishedContent(schema)).resolves.toEqual({
        title: "Из копии",
      });
      expect(fetchContent).not.toHaveBeenCalled();
    });

    it("stops, naming the file, when the site has no copy", async () => {
      copy.isContentCopyOnly = true;

      await expect(loadPublishedContent(schema)).rejects.toThrow(
        "SEAMLET_CONTENT=copy needs the copy of the content at seamlet/content.json",
      );
    });
  });
});
