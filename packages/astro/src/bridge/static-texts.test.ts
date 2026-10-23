// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { staticTextAround } from "./static-texts";

function element(selector: string): Element {
  const found = document.querySelector(selector);
  if (found === null) throw new Error(`No ${selector} in the page`);
  return found;
}

describe("staticTextAround", () => {
  it("finds the words of the site's own, marked as the code's or not", () => {
    document.body.innerHTML = `
      <nav data-cms-fixed><span id="fixed">Меню</span></nav>
      <p id="unmarked">Самовывоз <b>бесплатно</b></p>`;

    expect(staticTextAround(element("#fixed"))).toBe(element("#fixed"));
    expect(staticTextAround(element("#unmarked"))).toBe(element("#unmarked"));
    expect(staticTextAround(element("#unmarked b"))).toBe(
      element("#unmarked b"),
    );
  });

  it("finds none in a field, in a text being typed, in empty space or a lone sign", () => {
    document.body.innerHTML = `
      <section data-cms-path="hero"><p id="in-field">Кофейня</p></section>
      <p id="typed" contenteditable="true">Чай</p>
      <div id="empty"><p>Слова глубже</p></div>
      <span id="sign">→</span>`;

    expect(staticTextAround(element("#in-field"))).toBeUndefined();
    expect(staticTextAround(element("#typed"))).toBeUndefined();
    expect(staticTextAround(element("#empty"))).toBeUndefined();
    expect(staticTextAround(element("#sign"))).toBeUndefined();
    expect(staticTextAround(document)).toBeUndefined();
  });
});
