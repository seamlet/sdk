import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "./init-command";

let root: string;
let lines: string[];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "seamlet-init-"));
  lines = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function init(...argv: string[]): Promise<number> {
  return runInit({
    root,
    argv,
    log: (line) => {
      lines.push(line);
    },
  });
}

async function readConfig(): Promise<unknown> {
  return JSON.parse(await readFile(join(root, "seamlet.json"), "utf8"));
}

describe("runInit", () => {
  it("names the site after its package and its CMS by default", async () => {
    await writeFile(join(root, "package.json"), '{ "name": "dzen-yoga" }');

    const code = await init("init");

    expect(code).toBe(0);
    await expect(readConfig()).resolves.toEqual({
      id: "dzen-yoga",
      title: "dzen-yoga",
      cms: "https://cms.seamlet.ru",
    });
    expect(lines).toContain("wrote src/seamlet.ts");
  });

  it("takes the id, the title and the CMS from the options", async () => {
    const code = await init(
      "init",
      "--id",
      "lampgreen",
      "--title",
      "Лампа Грина",
      "--cms",
      "http://localhost:4321",
    );

    expect(code).toBe(0);
    await expect(readConfig()).resolves.toEqual({
      id: "lampgreen",
      title: "Лампа Грина",
      cms: "http://localhost:4321",
    });
  });

  it("keeps every file the site has already", async () => {
    await writeFile(join(root, "seamlet.json"), "{}");

    await init("init", "--id", "coffee-shop");

    await expect(readFile(join(root, "seamlet.json"), "utf8")).resolves.toBe(
      "{}",
    );
    expect(lines).toContain("kept seamlet.json: the site has it already");
    expect(lines).toContain("wrote src/schema.ts");
  });

  it("asks for an id the package's name does not give", async () => {
    await writeFile(join(root, "package.json"), '{ "name": "кофейня" }');

    const code = await init("init");

    expect(code).toBe(1);
    expect(lines[0]).toMatch(/^Give the site --id/u);
    await expect(
      readFile(join(root, "seamlet.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("says how to use it for another command or an unknown option", async () => {
    expect(await init()).toBe(2);
    expect(await init("build")).toBe(2);
    expect(await init("init", "--name", "zerno")).toBe(2);
    expect(lines.every((line) => line.startsWith("Usage:"))).toBe(true);
  });
});
