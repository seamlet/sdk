import { describe, expect, it } from "vitest";
import { pageBodyOf } from "../html-page-nodes";
import { describeUnmarkedText, unmarkedTextsOf } from "./unmarked-texts";

function unmarkedTextsIn(body: string): string[] {
  const page = pageBodyOf(`<!doctype html><html><body>${body}</body></html>`);
  if (page === undefined) throw new Error("the page has no body");
  return unmarkedTextsOf(page).map(describeUnmarkedText);
}

describe("unmarkedTextsOf", () => {
  it("names a text no field holds, with the elements around it", () => {
    const texts = unmarkedTextsIn(
      `<header class="top astro-x1"><nav><a class="link" href="/menu">Меню</a></nav></header>`,
    );

    expect(texts).toEqual(["«Меню» in header.top > nav > a.link"]);
  });

  it("leaves out texts inside a field and texts the code owns", () => {
    const texts = unmarkedTextsIn(
      `<h1 data-cms-path="hero.title">Кофе <em>с собой</em></h1>
       <p data-cms-fixed>© 2026 <span>Моя кофейня</span></p>`,
    );

    expect(texts).toEqual([]);
  });

  it("leaves out what a visitor does not read as words of the page", () => {
    const texts = unmarkedTextsIn(
      `<script>const greeting = "Привет";</script>
       <style>.a::after { content: "Привет"; }</style>
       <template><p>Привет</p></template>
       <p hidden>Привет</p>
       <span aria-hidden="true">Привет</span>
       <select><option>Выберите</option></select>
       <textarea>Привет</textarea>
       <svg><title>Привет</title></svg>
       <p>  ·  </p>
       <p> → </p>`,
    );

    expect(texts).toEqual([]);
  });

  it("collapses the spaces of a text and names it once per place", () => {
    const texts = unmarkedTextsIn(
      `<ul><li>Пн–Пт
         8:00–22:00</li><li>Пн–Пт 8:00–22:00</li></ul>`,
    );

    expect(texts).toEqual(["«Пн–Пт 8:00–22:00» in body > ul > li"]);
  });

  it("names the closest three elements around a text", () => {
    const texts = unmarkedTextsIn(
      `<footer><div><nav><ul><li>Разделы</li></ul></nav></div></footer>`,
    );

    expect(texts).toEqual(["«Разделы» in nav > ul > li"]);
  });
});
