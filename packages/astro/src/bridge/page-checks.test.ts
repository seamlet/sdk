// @vitest-environment jsdom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { pageNodeOf, warnAboutUnreachableFields } from "./page-checks";
import { unmarkedTextsOf } from "./unmarked-texts";

const SETTLED = 1000;

function placeAt(
  element: Element,
  box: { left: number; top: number; width: number; height: number },
): void {
  element.getBoundingClientRect = () =>
    DOMRect.fromRect({
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
    });
}

function warnings(warn: MockInstance<typeof console.warn>): string[] {
  return warn.mock.calls.map(([message]) => String(message));
}

let warn: MockInstance<typeof console.warn>;
let stop: () => void = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const root = document.documentElement;
  Object.defineProperty(root, "clientWidth", {
    value: 1000,
    configurable: true,
  });
  Object.defineProperty(root, "clientHeight", {
    value: 800,
    configurable: true,
  });
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("pageNodeOf", () => {
  it("reads the page's elements and texts for the check of texts", () => {
    document.body.innerHTML = `<nav><a href="/menu">Меню</a></nav><h1 data-cms-path="hero.title">Кофе</h1>`;
    const page = pageNodeOf(document.body);
    if (page === undefined) throw new Error("the body was not read");

    expect(unmarkedTextsOf(page)).toEqual([
      { text: "Меню", location: "body > nav > a" },
    ]);
  });
});

describe("warnAboutUnreachableFields", () => {
  it("warns once about the texts no field holds", () => {
    document.body.innerHTML = `<footer><p>Разделы</p></footer>`;
    stop = warnAboutUnreachableFields(document);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(SETTLED);

    expect(warnings(warn)).toEqual([
      expect.stringContaining("«Разделы» in body > footer > p"),
    ]);
  });

  it("warns once about a field in view another element covers, once the page is still", () => {
    document.body.innerHTML = `
      <article data-cms-path="products.0">
        <h3 data-cms-path="products.0.name"><a class="card-link" href="/p">Пион</a></h3>
        <p data-cms-path="products.0.price">900</p>
      </article>`;
    const card = document.querySelector("article");
    const link = document.querySelector("a");
    const name = document.querySelector('[data-cms-path="products.0.name"]');
    const price = document.querySelector('[data-cms-path="products.0.price"]');
    if (card === null || link === null || name === null || price === null) {
      throw new Error("the card is not on the page");
    }
    placeAt(card, { left: 0, top: 0, width: 300, height: 400 });
    placeAt(name, { left: 0, top: 300, width: 300, height: 30 });
    placeAt(price, { left: 0, top: 340, width: 100, height: 20 });
    // The link of the name is stretched over the whole card.
    document.elementFromPoint = () => link;

    stop = warnAboutUnreachableFields(document);
    vi.advanceTimersByTime(SETTLED);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(SETTLED);

    expect(warnings(warn)).toEqual([
      expect.stringContaining(
        "products.*.price is under the field products.*.name (a.card-link)",
      ),
    ]);
  });
});
