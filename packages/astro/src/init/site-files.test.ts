import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readSiteConfig, readSiteDescription } from "../schema";
import { configFileOf, moduleFilesOf, siteIdOf } from "./site-files";

const config = {
  id: "dzen-yoga",
  title: "Студия «Дзен»",
  cms: "https://cms.seamlet.ru",
};

describe("siteFilesOf", () => {
  it("starts the site with a seamlet.json the integration and the CMS read", () => {
    const file = configFileOf(config);

    const reading = readSiteConfig(JSON.parse(file.text));

    expect(reading).toEqual({ status: "read", config });
  });

  it("gives the module, its schema and a first page the README names", () => {
    const paths = moduleFilesOf(config).map((file) => file.path);

    expect(paths).toEqual([
      "src/schema.ts",
      "src/seamlet.ts",
      "src/components/HomePage.astro",
    ]);
  });

  it("starts the content with the site's title, written as a string of TypeScript", () => {
    const schema = moduleFilesOf({ ...config, title: 'Кафе "Ёлка"' }).find(
      (file) => file.path === "src/schema.ts",
    );

    expect(schema?.text).toContain('title: "Кафе \\"Ёлка\\""');
  });
});

describe("siteIdOf", () => {
  it("takes the id from a package's name", () => {
    expect(siteIdOf("dzen-yoga")).toBe("dzen-yoga");
    expect(siteIdOf("@bysavelii/Lamp_Green")).toBe("lamp-green");
    expect(siteIdOf("  coffee   shop ")).toBe("coffee-shop");
  });

  it("gives none for a name with nothing the CMS takes", () => {
    expect(siteIdOf("")).toBeUndefined();
    expect(siteIdOf("@scope/---")).toBeUndefined();
    expect(siteIdOf("кофейня")).toBeUndefined();
  });
});

describe("the schema module of a new site", () => {
  it("takes a long title the CMS accepts as the site's description", async () => {
    const title = "Очень длинное название студии ".repeat(4).trim();
    const { schema, initialContent } = await importSchemaModule(title);

    const description = readSiteDescription({
      id: config.id,
      title,
      schema,
      initialContent,
      pages: [{ path: "/", title: "Главная" }],
    });

    expect(title.length).toBeGreaterThan(100);
    expect(description?.initialContent).toEqual({ title });
  });
});

/** The generated `src/schema.ts`, imported with the schema language of this package. */
async function importSchemaModule(
  title: string,
): Promise<{ schema: unknown; initialContent: unknown }> {
  const file = moduleFilesOf({ ...config, title }).find(
    (each) => each.path === "src/schema.ts",
  );
  const schemaLanguage = fileURLToPath(
    new URL("../schema/index.ts", import.meta.url),
  );
  const text = (file?.text ?? "").replace(
    '"@seamlet/astro/schema"',
    JSON.stringify(schemaLanguage),
  );
  const directory = await mkdtemp(join(tmpdir(), "seamlet-schema-"));
  const path = join(directory, "schema.ts");
  await writeFile(path, text);
  try {
    return (await import(path)) as { schema: unknown; initialContent: unknown };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
