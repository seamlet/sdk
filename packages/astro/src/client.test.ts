import { afterEach, describe, expect, it, vi } from "vitest";

const connectToEditor = vi.fn();

vi.mock("virtual:seamlet/config", () => ({ cmsOrigin: "https://cms.example" }));
vi.mock("./bridge", () => ({ connectToEditor }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  connectToEditor.mockReset();
});

/** Loads the script every page of the site has, at the address, in a frame or not. */
async function loadPage(pathname: string, isFramed: boolean): Promise<void> {
  const page: { parent?: unknown; location: { pathname: string } } = {
    location: { pathname },
  };
  page.parent = isFramed ? {} : page;
  vi.stubGlobal("window", page);
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
});
