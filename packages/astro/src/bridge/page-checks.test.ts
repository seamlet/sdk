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
        <p data-cms-path="products.0.price">900</p>
      </article>
      <div class="veil"></div>`;
    const card = document.querySelector("article");
    const price = document.querySelector('[data-cms-path="products.0.price"]');
    const veil = document.querySelector(".veil");
    if (card === null || price === null || veil === null) {
      throw new Error("the card is not on the page");
    }
    placeAt(card, { left: 0, top: 0, width: 300, height: 400 });
    placeAt(price, { left: 0, top: 340, width: 100, height: 20 });
    // A veil of the page, outside the card, lies over it and holds no field.
    document.elementFromPoint = () => veil;

    stop = warnAboutUnreachableFields(document);
    vi.advanceTimersByTime(SETTLED);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(SETTLED);

    expect(warnings(warn)).toEqual([
      expect.stringContaining("products.*.price is under div.veil"),
    ]);
  });

  it("finds a field under its card's stretched link reachable: a click chooses it by its box", () => {
    document.body.innerHTML = `
      <article data-cms-path="products.0">
        <h3 data-cms-path="products.0.name"><a class="card-link" href="/p" data-cms-fixed>Пион</a></h3>
        <p data-cms-path="products.0.price" data-cms-fixed>900</p>
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

    expect(warnings(warn)).toEqual([]);
  });

  it("leaves out a field scrolled under a sticky header: it is not in view yet", () => {
    document.body.innerHTML = `
      <header style="position: sticky"><a href="/" data-cms-fixed>Пион</a></header>
      <h2 data-cms-path="catalog.title">Каталог</h2>`;
    const header = document.querySelector("header");
    const title = document.querySelector("h2");
    if (header === null || title === null) {
      throw new Error("the header is not on the page");
    }
    placeAt(header, { left: 0, top: 0, width: 1000, height: 80 });
    placeAt(title, { left: 40, top: 20, width: 480, height: 40 });
    document.elementFromPoint = () => header;

    stop = warnAboutUnreachableFields(document);
    vi.advanceTimersByTime(SETTLED);

    expect(warnings(warn)).toEqual([]);
  });
});
