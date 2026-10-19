// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPageRenderer, replacePageBody } from "./page-rendering";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/preview/menu#drinks");
  document.title = "Старое";
  document.body.innerHTML = "<h1>Старое</h1>";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function page(title: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body class="site"><h1>${title}</h1></body></html>`;
}

function renderer(
  canReplacePage = () => true,
  isPagePressed: () => boolean = () => false,
) {
  const onRendered = vi.fn();
  const onFailed = vi.fn();
  const pageRenderer = createPageRenderer({
    document,
    canReplacePage,
    isPagePressed,
    onRendered,
    onFailed,
  });
  return { pageRenderer, onRendered, onFailed };
}

describe("replacePageBody", () => {
  it("replaces the body and the title and keeps the document", () => {
    replacePageBody(document, page("Новое"));

    expect(document.title).toBe("Новое");
    expect(document.body.className).toBe("site");
    expect(document.querySelector("h1")?.textContent).toBe("Новое");
  });
});

describe("createPageRenderer", () => {
  it("posts the content to the page's own address and shows what the site rendered", async () => {
    fetchMock.mockResolvedValue(new Response(page("Новое")));
    const { pageRenderer, onRendered } = renderer();

    pageRenderer.render({ title: "Новое" });
    await vi.waitFor(() => {
      expect(onRendered).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${window.location.origin}/preview/menu`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ title: "Новое" }));
    expect(document.title).toBe("Новое");
  });

  it("cancels the request of a render that a newer one replaces", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    const { pageRenderer } = renderer();

    pageRenderer.render({ title: "Первое" });
    pageRenderer.render({ title: "Второе" });

    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(firstSignal?.aborted).toBe(true);
  });

  it("leaves the page as it is while it may not be replaced", async () => {
    fetchMock.mockResolvedValue(new Response(page("Новое")));
    const isAsked = vi.fn(() => false);
    const { pageRenderer, onRendered } = renderer(isAsked);

    pageRenderer.render({ title: "Новое" });
    await vi.waitFor(() => {
      expect(isAsked).toHaveBeenCalled();
    });

    expect(document.title).toBe("Старое");
    expect(onRendered).not.toHaveBeenCalled();
  });

  it("holds a page rendered during a press until the press is over", async () => {
    let isPressed = true;
    fetchMock.mockResolvedValue(new Response(page("Новое")));
    const isPressAsked = vi.fn(() => isPressed);
    const { pageRenderer, onRendered } = renderer(() => true, isPressAsked);

    pageRenderer.render({ title: "Новое" });
    await vi.waitFor(() => {
      expect(isPressAsked).toHaveBeenCalled();
    });

    expect(document.title).toBe("Старое");

    isPressed = false;
    pageRenderer.showHeldPage();

    expect(document.title).toBe("Новое");
    expect(onRendered).toHaveBeenCalledOnce();
  });

  it("drops a held page once the click started typing", async () => {
    fetchMock.mockResolvedValue(new Response(page("Новое")));
    let isPressed = true;
    let isTyping = false;
    const isPressAsked = vi.fn(() => isPressed);
    const { pageRenderer, onRendered } = renderer(
      () => !isTyping,
      isPressAsked,
    );
    pageRenderer.render({ title: "Новое" });
    await vi.waitFor(() => {
      expect(isPressAsked).toHaveBeenCalled();
    });

    isPressed = false;
    isTyping = true;
    pageRenderer.showHeldPage();
    isTyping = false;
    pageRenderer.showHeldPage();

    expect(document.title).toBe("Старое");
    expect(onRendered).not.toHaveBeenCalled();
  });

  it("reports a failed render", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const { pageRenderer, onFailed } = renderer();

    pageRenderer.render({ title: "Новое" });

    await vi.waitFor(() => {
      expect(onFailed).toHaveBeenCalledTimes(1);
    });
  });
});
