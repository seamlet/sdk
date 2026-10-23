import { describe, expect, it } from "vitest";
import { llmsTxtOf } from "./llms-txt";

describe("llms.txt", () => {
  it("writes the name, the line about the site and the pages under their headings", () => {
    const text = llmsTxtOf({
      title: "Моя кофейня",
      summary: "Кофе и завтраки\nу парка",
      sections: [
        {
          title: "Страницы",
          pages: [
            {
              url: "https://example.ru/",
              name: "Кофейня у парка",
              description: "Кофе и завтраки у парка",
            },
            { url: "https://example.ru/menu", name: "Меню", description: "" },
          ],
        },
        { title: "Пустое", pages: [] },
        {
          title: "Меню",
          pages: [
            {
              url: "https://example.ru/menu/raf-(new)",
              name: "Раф [сезон]",
              description: "Сливки и ваниль",
            },
          ],
        },
      ],
    });

    expect(text).toBe(
      [
        "# Моя кофейня",
        "",
        "> Кофе и завтраки у парка",
        "",
        "## Страницы",
        "",
        "- [Кофейня у парка](https://example.ru/): Кофе и завтраки у парка",
        "- [Меню](https://example.ru/menu)",
        "",
        "## Меню",
        "",
        "- [Раф \\[сезон\\]](https://example.ru/menu/raf-%28new%29): Сливки и ваниль",
        "",
      ].join("\n"),
    );
  });

  it("leaves out an empty line about the site", () => {
    expect(llmsTxtOf({ title: "Сайт", summary: " ", sections: [] })).toBe(
      "# Сайт\n",
    );
  });
});
