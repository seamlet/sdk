import { describe, expect, it } from "vitest";
import { isSiteId, readSiteConfig } from "./site-config";

describe("readSiteConfig", () => {
  it("reads the id, the name and the CMS's origin of a site", () => {
    const reading = readSiteConfig({
      id: "dzen-yoga",
      title: " Студия йоги «Дзен» ",
      cms: "https://cms.seamlet.ru/",
    });

    expect(reading).toEqual({
      status: "read",
      config: {
        id: "dzen-yoga",
        title: "Студия йоги «Дзен»",
        cms: "https://cms.seamlet.ru",
      },
    });
  });

  it("leaves out the fields it does not know", () => {
    const reading = readSiteConfig({
      $schema: "https://example.com/seamlet.schema.json",
      id: "coffee-shop",
      title: "Зерно",
      cms: "http://localhost:4321",
    });

    expect(reading).toEqual({
      status: "read",
      config: {
        id: "coffee-shop",
        title: "Зерно",
        cms: "http://localhost:4321",
      },
    });
  });

  it("names every field that is missing or wrong, in the order of the file", () => {
    expect(
      readSiteConfig({ id: "Coffee Shop", title: "  ", cms: "ftp://cms" }),
    ).toEqual({ status: "invalid", invalidFields: ["id", "title", "cms"] });
    expect(readSiteConfig({ id: "coffee-shop", title: "Зерно" })).toEqual({
      status: "invalid",
      invalidFields: ["cms"],
    });
    expect(
      readSiteConfig({ id: "coffee-shop", title: 7, cms: "not an address" }),
    ).toEqual({ status: "invalid", invalidFields: ["title", "cms"] });
  });

  it("finds nothing in what is not an object", () => {
    for (const input of [null, "coffee-shop", ["coffee-shop"], 42]) {
      expect(readSiteConfig(input)).toEqual({
        status: "invalid",
        invalidFields: ["id", "title", "cms"],
      });
    }
  });
});

describe("isSiteId", () => {
  it("takes lower-case letters, digits and single hyphens between them", () => {
    expect(["coffee-shop", "lampgreen", "studio-2"].every(isSiteId)).toBe(true);
  });

  it("refuses what cannot name an address, a file or the host of a preview", () => {
    const refused = [
      "",
      "Coffee",
      "coffee_shop",
      "-coffee",
      "coffee-",
      "coffee--shop",
      "coffee.shop",
      "a".repeat(64),
      42,
    ];

    expect(refused.filter(isSiteId)).toEqual([]);
    expect(isSiteId("a".repeat(63))).toBe(true);
  });
});
