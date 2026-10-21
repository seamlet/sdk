import { afterEach, describe, expect, it, vi } from "vitest";

const connectToEditor = vi.fn();
const connectRequestForms = vi.fn();

vi.mock("virtual:seamlet/config", () => ({ cmsOrigin: "https://cms.example" }));
vi.mock("./bridge", () => ({ connectToEditor }));
vi.mock("./request-sending", () => ({ connectRequestForms }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  connectToEditor.mockReset();
  connectRequestForms.mockReset();
});

/** Loads the script every page of the site has, at the address, in a frame or not. */
async function loadPage(
  pathname: string,
  isFramed: boolean,
  hasRequestForm = false,
): Promise<void> {
  const page: { parent?: unknown; location: { pathname: string } } = {
    location: { pathname },
  };
  page.parent = isFramed ? {} : page;
  const form = hasRequestForm ? {} : null;
  const document = { querySelector: () => form };
  vi.stubGlobal("window", page);
  vi.stubGlobal("document", document);
  vi.resetModules();
  await import("./client");
  await vi.dynamicImportSettled();
}

describe("the script of every page", () => {
  it("loads the bridge on the preview in the editor's frame", async () => {
    await loadPage("/preview", true);
    await loadPage("/preview/menu", true);

    expect(connectToEditor.mock.calls).toEqual([
      [{ editorOrigin: "https://cms.example" }],
      [{ editorOrigin: "https://cms.example" }],
    ]);
  });

  it("loads nothing elsewhere or outside a frame", async () => {
    await loadPage("/previewer", true);
    await loadPage("/menu", true);
    await loadPage("/preview", false);

    expect(connectToEditor).not.toHaveBeenCalled();
  });

  it("sends requests in place only on a page with a form of them", async () => {
    await loadPage("/contacts", false, true);
    await loadPage("/menu", false);

    expect(connectRequestForms).toHaveBeenCalledTimes(1);
    expect(connectRequestForms.mock.calls[0]?.[1]).toEqual({
      isPreview: false,
    });
  });

  it("keeps a form of the preview from sending", async () => {
    await loadPage("/preview/contacts", true, true);

    expect(connectRequestForms.mock.calls[0]?.[1]).toEqual({ isPreview: true });
  });
});
