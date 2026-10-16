import { describe, expect, it } from "vitest";
import { pickFaces } from "./assets";

const face = (subset: string) => `/* ${subset} */
@font-face {
  font-family: 'Some Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 400 800;
  src: url(./files/some-${subset}-wght-normal.woff2) format('woff2-variations');
  unicode-range: U+0000-00FF;
}`;

describe("pickFaces", () => {
  const stylesheet = [
    "cyrillic-ext",
    "cyrillic",
    "vietnamese",
    "latin-ext",
    "latin",
  ]
    .map(face)
    .join("\n\n");

  it("keeps Cyrillic, Latin and Latin Extended (for «₽») and drops the rest", () => {
    expect(pickFaces(stylesheet, "Some").map((f) => f.file)).toEqual([
      "some-cyrillic-wght-normal.woff2",
      "some-latin-ext-wght-normal.woff2",
      "some-latin-wght-normal.woff2",
    ]);
  });

  it("renames the family, points at the package's own files and keeps font-display: swap", () => {
    const [first] = pickFaces(stylesheet, "Some");
    expect(first?.css).toContain('font-family: "Some";');
    expect(first?.css).toContain(
      "url(./fonts/some-cyrillic-wght-normal.woff2)",
    );
    expect(first?.css).toContain("font-display: swap;");
  });
});
