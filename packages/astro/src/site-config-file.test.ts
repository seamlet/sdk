import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSiteConfig } from "./site-config-file";

let folder: string;
let root: URL;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "seamlet-config-"));
  root = pathToFileURL(`${folder}/`);
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

async function writeConfig(text: string): Promise<void> {
  await writeFile(join(folder, "seamlet.json"), text);
}

describe("loadSiteConfig", () => {
  it("reads seamlet.json at the site's root", async () => {
    await writeConfig(
      JSON.stringify({
        id: "dzen-yoga",
        title: "Студия йоги «Дзен»",
        cms: "https://cms.seamlet.ru",
      }),
    );

    await expect(loadSiteConfig(root, undefined)).resolves.toEqual({
      id: "dzen-yoga",
      title: "Студия йоги «Дзен»",
      cms: "https://cms.seamlet.ru",
    });
  });

  it("takes the CMS of the environment over the file's", async () => {
    await writeConfig(
      JSON.stringify({
        id: "dzen-yoga",
        title: "Дзен",
        cms: "https://cms.seamlet.ru",
      }),
    );

    const config = await loadSiteConfig(root, "http://localhost:4321/");

    expect(config.cms).toBe("http://localhost:4321");
  });

  it("lets the environment give the CMS a file leaves out", async () => {
    await writeConfig(JSON.stringify({ id: "dzen-yoga", title: "Дзен" }));

    const config = await loadSiteConfig(root, "https://cms.seamlet.ru");

    expect(config.cms).toBe("https://cms.seamlet.ru");
  });

  it("says the file is missing", async () => {
    await expect(loadSiteConfig(root, undefined)).rejects.toThrow(
      /seamlet\.json is missing/u,
    );
  });

  it("says the file is not JSON", async () => {
    await writeConfig("{ id: dzen-yoga }");

    await expect(loadSiteConfig(root, undefined)).rejects.toThrow(
      /seamlet\.json is not JSON/u,
    );
  });

  it("names each field to fix and what it must be", async () => {
    await writeConfig(
      JSON.stringify({ id: "Dzen Yoga", cms: "cms.seamlet.ru" }),
    );

    const loading = loadSiteConfig(root, undefined);

    await expect(loading).rejects.toThrow(/"id": the site's id in the CMS/u);
    await expect(loading).rejects.toThrow(
      /"title": how the CMS names the site/u,
    );
    await expect(loading).rejects.toThrow(/"cms": the address of the CMS/u);
  });
});
