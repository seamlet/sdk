import { describe, expect, expectTypeOf, it } from "vitest";
import {
  defaultContent,
  defineSchema,
  file,
  parseContent,
  readFields,
  type ContentOf,
  type FileValue,
} from "./index";

const schema = defineSchema({
  priceList: file({ label: "Прайс-лист" }),
});

describe("a file field", () => {
  it("holds the address of a document and the name the site shows for it", () => {
    const value = { src: "/media/lesnaya/0123456789abcdef.pdf", name: "Прайс" };

    const parsed = parseContent(schema, { priceList: value });

    expect(parsed).toEqual({ content: { priceList: value }, issues: [] });
    expectTypeOf<
      ContentOf<typeof schema>["priceList"]
    >().toEqualTypeOf<FileValue | null>();
  });

  it("starts empty and may stay so", () => {
    expect(defaultContent(schema)).toEqual({ priceList: null });
    expect(parseContent(schema, { priceList: null }).issues).toEqual([]);
  });

  it("asks for the file of a name without one", () => {
    const parsed = parseContent(schema, {
      priceList: { src: "", name: "Прайс" },
    });

    expect(parsed.issues).toEqual([
      { path: ["priceList"], code: "missing-file-src" },
    ]);
  });

  it("refuses a value of another shape", () => {
    const parsed = parseContent(schema, { priceList: "/price.pdf" });

    expect(parsed.content.priceList).toBeNull();
    expect(parsed.issues).toEqual([
      { path: ["priceList"], code: "invalid-type" },
    ]);
  });

  it("is read back from the description a site hands out", () => {
    const read = readFields(JSON.parse(JSON.stringify(schema)));

    expect(read).toEqual(schema);
  });
});
