import { describe, expect, it } from "vitest";
import { readSiteConfig } from "../schema";
import { siteFilesOf, siteIdOf } from "./site-files";

const config = {
  id: "dzen-yoga",
  title: "Студия «Дзен»",
  cms: "https://cms.seamlet.ru",
};

describe("siteFilesOf", () => {
  it("starts the site with a seamlet.json the integration and the CMS read", () => {
    const file = siteFilesOf(config).find(
      (each) => each.path === "seamlet.json",
    );

    const reading = readSiteConfig(JSON.parse(file?.text ?? "null"));

    expect(reading).toEqual({ status: "read", config });
  });

  it("gives the module, its schema and a first page the README names", () => {
    const paths = siteFilesOf(config).map((file) => file.path);

    expect(paths).toEqual([
      "seamlet.json",
      "src/schema.ts",
      "src/seamlet.ts",
      "src/components/HomePage.astro",
    ]);
  });

  it("starts the content with the site's title, written as a string of TypeScript", () => {
    const schema = siteFilesOf({ ...config, title: 'Кафе "Ёлка"' }).find(
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
