import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import StructuredData from "../components/StructuredData.astro";
import { faqPageOf, localBusinessOf } from "./search";

// The structured data a site renders in its pages: a data block of JSON that no word of the
// content can close, read back as the same things.

async function render(value: unknown): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(StructuredData, { props: { value } });
}

describe("the structured data of a page", () => {
  it("is one data block of JSON-LD that no word can close", async () => {
    const name = "Ромашка</script><script>alert(1)</script>";
    const business = localBusinessOf({
      type: "Florist",
      name,
      url: "https://example.ru",
    });

    const markup = await render(business);
    const match =
      /^<script type="application\/ld\+json">(.*)<\/script>$/su.exec(
        markup.trim(),
      );

    expect(match).not.toBeNull();
    expect(JSON.parse(match?.[1] ?? "")).toEqual({
      "@context": "https://schema.org",
      ...business,
      name,
    });
  });

  it("is nothing when there is nothing to say", async () => {
    expect((await render([faqPageOf([])])).trim()).toBe("");
  });
});
