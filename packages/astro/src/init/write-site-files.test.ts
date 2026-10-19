import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeSiteFiles } from "./write-site-files";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "seamlet-files-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const files = [
  { path: "src/schema.ts", text: "schema" },
  { path: "src/seamlet.ts", text: "module" },
];

describe("writeSiteFiles", () => {
  it("writes files that go together into the folders they need", async () => {
    const written = await writeSiteFiles(root, files);

    expect(written).toEqual({
      written: ["src/schema.ts", "src/seamlet.ts"],
      kept: [],
    });
    await expect(readFile(join(root, "src/seamlet.ts"), "utf8")).resolves.toBe(
      "module",
    );
  });

  it("keeps all of them when the site has one, and keeps that one as it is", async () => {
    await writeSiteFiles(root, [{ path: "src/seamlet.ts", text: "own" }]);

    const written = await writeSiteFiles(root, files);

    expect(written).toEqual({
      written: [],
      kept: ["src/schema.ts", "src/seamlet.ts"],
    });
    await expect(readFile(join(root, "src/seamlet.ts"), "utf8")).resolves.toBe(
      "own",
    );
  });

  it("says which file it could not look at when the folder is not one", async () => {
    const notFolder = join(root, "file");
    await writeFile(notFolder, "");

    await expect(writeSiteFiles(notFolder, files)).rejects.toThrow(
      `@seamlet/astro: cannot read ${join(notFolder, "src/schema.ts")}`,
    );
  });
});
