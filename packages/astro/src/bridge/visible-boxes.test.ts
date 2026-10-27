// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { measureVisibleBoxes } from "./visible-boxes";

// jsdom lays nothing out: every element is given its box, and the browser's answer to what is seen
// at a point, by the test.

const boxes = new Map<string, DOMRect>();

function place(
  html: string,
  placed: Record<string, readonly [number, number, number, number]>,
) {
  document.body.innerHTML = html;
  boxes.clear();
  for (const [id, [left, top, width, height]] of Object.entries(placed)) {
    boxes.set(id, new DOMRect(left, top, width, height));
  }
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return boxes.get(this.id) ?? new DOMRect(0, 0, 1280, 4000);
    },
  );
}

/** The browser sees the element with the id on top wherever the overlap is. */
function seeOnTop(id: string) {
  document.elementFromPoint = () => document.getElementById(id);
}

function element(id: string): Element {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`No element #${id}`);
  return found;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("measureVisibleBoxes", () => {
  it("gives the whole box of an element nothing clips or covers", () => {
    place(`<section id="section"><h2 id="title">Меню</h2></section>`, {
      title: [40, 300, 400, 40],
    });

    const shown = measureVisibleBoxes(document)(element("title"));

    expect(shown).toEqual({ top: 300, left: 40, width: 400, height: 40 });
  });

  it("cuts a card to the strip it scrolls sideways in", () => {
    place(
      `<div id="strip" style="overflow-x: auto"><article id="card">Спектакль</article></div>`,
      { strip: [0, 200, 1000, 300], card: [900, 220, 300, 260] },
    );

    const shown = measureVisibleBoxes(document)(element("card"));

    expect(shown).toEqual({ top: 220, left: 900, width: 100, height: 260 });
  });

  it("sees nothing of a card scrolled out of its strip", () => {
    place(
      `<div id="strip" style="overflow-x: hidden; overflow-y: hidden"><article id="card">Спектакль</article></div>`,
      { strip: [0, 200, 1000, 300], card: [1100, 220, 300, 260] },
    );

    expect(measureVisibleBoxes(document)(element("card"))).toBeUndefined();
  });

  it("lets an element positioned absolutely out of a static ancestor that clips", () => {
    place(
      `<div id="card" style="position: relative">
        <div id="crop" style="overflow-x: hidden; overflow-y: hidden"><span id="badge" style="position: absolute">−15%</span></div>
      </div>`,
      {
        card: [0, 0, 400, 400],
        crop: [0, 0, 100, 100],
        badge: [80, 10, 60, 20],
      },
    );

    const shown = measureVisibleBoxes(document)(element("badge"));

    expect(shown).toEqual({ top: 10, left: 80, width: 60, height: 20 });
  });

  it("cuts the band a sticky header covers at the top of an element", () => {
    place(
      `<header id="header" style="position: sticky"><a href="/">Пион</a></header>
      <h2 id="title">Разделы каталога</h2>`,
      { header: [0, 0, 1280, 60], title: [40, 40, 480, 40] },
    );
    seeOnTop("header");

    const shown = measureVisibleBoxes(document)(element("title"));

    expect(shown).toEqual({ top: 60, left: 40, width: 480, height: 20 });
  });

  it("cuts the band a bar fixed at the bottom of the screen covers", () => {
    place(
      `<p id="lead">Цены обновляем каждое утро</p>
      <div id="bar" style="position: fixed">Позвонить</div>`,
      { lead: [40, 760, 480, 60], bar: [0, 780, 1280, 120] },
    );
    seeOnTop("bar");

    const shown = measureVisibleBoxes(document)(element("lead"));

    expect(shown).toEqual({ top: 760, left: 40, width: 480, height: 20 });
  });

  it("sees nothing of an element wholly under a sticky header", () => {
    place(
      `<header id="header" style="position: sticky"></header><h2 id="title">Каталог</h2>`,
      { header: [0, 0, 1280, 80], title: [40, 20, 480, 40] },
    );
    seeOnTop("header");

    expect(measureVisibleBoxes(document)(element("title"))).toBeUndefined();
  });

  it("keeps an element whole where a fixed part lies under it", () => {
    place(
      `<div id="glow" style="position: fixed"></div><h2 id="title">Каталог</h2>`,
      { glow: [0, 0, 1280, 800], title: [40, 20, 480, 40] },
    );
    seeOnTop("title");

    const shown = measureVisibleBoxes(document)(element("title"));

    expect(shown).toEqual({ top: 20, left: 40, width: 480, height: 40 });
  });

  it("keeps an element whole where a fixed part covers only some of its width", () => {
    place(
      `<button id="booking" style="position: fixed">Записаться</button><p id="lead">Текст</p>`,
      { booking: [1100, 700, 160, 60], lead: [40, 680, 1200, 100] },
    );
    seeOnTop("booking");

    const shown = measureVisibleBoxes(document)(element("lead"));

    expect(shown).toEqual({ top: 680, left: 40, width: 1200, height: 100 });
  });

  it("keeps the fields of a sticky header whole", () => {
    place(
      `<header id="header" style="position: sticky"><a id="phone" href="tel:+70000000000">+7 (000) 000-00-00</a></header>`,
      { header: [0, 0, 1280, 60], phone: [900, 20, 200, 20] },
    );
    seeOnTop("phone");

    const shown = measureVisibleBoxes(document)(element("phone"));

    expect(shown).toEqual({ top: 20, left: 900, width: 200, height: 20 });
  });
});
