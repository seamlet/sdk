import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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

  it("writes the modules for the site's own seamlet.json", async () => {
    const own = {
      id: "zerno",
      title: "Кофейня «Зерно»",
      cms: "https://cms.example",
    };
    await writeFile(join(root, "seamlet.json"), JSON.stringify(own));

    const code = await init("init", "--id", "coffee-shop", "--title", "Другое");

    expect(code).toBe(0);
    await expect(readConfig()).resolves.toEqual(own);
    await expect(
      readFile(join(root, "src", "schema.ts"), "utf8"),
    ).resolves.toContain('title: "Кофейня «Зерно»"');
    expect(lines).toContain(
      "kept seamlet.json: the site has it, or a file that goes with it, already",
    );
    expect(lines).toContain("wrote src/schema.ts");
  });

  it("refuses a seamlet.json it cannot read, and writes nothing", async () => {
    await writeFile(join(root, "seamlet.json"), '{ "id": "Зерно" }');

    const code = await init("init", "--id", "coffee-shop");

    expect(code).toBe(1);
    expect(lines[0]).toMatch(/seamlet\.json needs "id", "title", "cms"/u);
    await expect(access(join(root, "src"))).rejects.toThrow();
  });

  it("writes none of the modules when the site has one of them", async () => {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "seamlet.ts"), "// the site's own");

    await init("init", "--id", "coffee-shop");

    await expect(
      readFile(join(root, "src", "seamlet.ts"), "utf8"),
    ).resolves.toBe("// the site's own");
    await expect(access(join(root, "src", "schema.ts"))).rejects.toThrow();
    expect(lines).toContain("wrote seamlet.json");
    expect(lines).toContain(
      "kept src/schema.ts: the site has it, or a file that goes with it, already",
    );
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
