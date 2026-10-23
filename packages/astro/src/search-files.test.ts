import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasOwnFile } from "./search-files";

let root: string;
let folders: { publicDir: URL; srcDir: URL };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "seamlet-site-"));
  folders = {
    publicDir: pathToFileURL(join(root, "public/")),
    srcDir: pathToFileURL(join(root, "src/")),
  };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("a file of the site's own", () => {
  it("is none when the site has neither a public file nor a route", async () => {
    expect(await hasOwnFile(folders, "/robots.txt")).toBe(false);
  });

  it("is a file in public", async () => {
    await mkdir(join(root, "public"));
    await writeFile(join(root, "public", "robots.txt"), "User-agent: *");

    expect(await hasOwnFile(folders, "/robots.txt")).toBe(true);
  });

  it("is a route in src/pages", async () => {
    await mkdir(join(root, "src", "pages"), { recursive: true });
    await writeFile(join(root, "src", "pages", "llms.txt.ts"), "");

    expect(await hasOwnFile(folders, "/llms.txt")).toBe(true);
    expect(await hasOwnFile(folders, "/robots.txt")).toBe(false);
  });
});
