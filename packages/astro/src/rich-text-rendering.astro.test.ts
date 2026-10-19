import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import RichTextComponent from "../components/RichText.astro";
import { renderInlineRichText, renderRichText } from "./bridge/rich-text-dom";
import type { RichText } from "./schema";

// The bridge types a formatted text in place only when its element holds what RichText renders,
// and renders it anew with its own code while it is typed: the two must give the same elements.
// Astro renders in Node, so the page's document is one of jsdom's own.

const { document } = new JSDOM().window;

const text: RichText = [
  {
    kind: "paragraph",
    spans: [
      { text: "Запись в " },
      { text: "расписании", bold: true, italic: true, href: "/raspisanie" },
      { text: "\nи по телефону", italic: true },
      { text: ", не ", href: "javascript:alert(1)" },
      { text: "сюда", bold: true, href: "data:text/html,<b>" },
    ],
  },
  {
    kind: "list",
    items: [[{ text: "Коврики" }], [{ text: "Чай", href: "tel:+70000000000" }]],
  },
];

async function renderedByComponent(isInline: boolean): Promise<string> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(RichTextComponent, {
    props: { value: text, inline: isInline },
  });
  return normalized(html);
}

/** The markup as the page's DOM holds it, without Astro's comments and the spaces between tags. */
function normalized(html: string): string {
  const element = document.createElement("div");
  element.innerHTML = html.replaceAll(/<!--[^]*?-->/gu, "");
  return element.innerHTML;
}

describe("formatted text rendered by the site and by the bridge", () => {
  it("is the same paragraphs and lists, without the links that would run code", async () => {
    const element = document.createElement("div");
    renderRichText(element, text);

    const component = await renderedByComponent(false);

    expect(component).toBe(element.innerHTML);
    expect(component).not.toMatch(/javascript:|data:/u);
  });

  it("is the same words alone in an element of one line", async () => {
    const element = document.createElement("h1");
    renderInlineRichText(element, text);

    const component = await renderedByComponent(true);

    expect(component).toBe(element.innerHTML);
  });
});
