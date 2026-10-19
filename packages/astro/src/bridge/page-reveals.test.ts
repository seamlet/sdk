// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVEAL_EVENT } from "../schema";
import { listenToPage, type PageListeners } from "./page-events";
import {
  restoreRevealedParts,
  revealAround,
  revealedPartsOf,
} from "./page-reveals";
import { replacePageBody } from "./page-rendering";

const PAGE = `
  <details id="yin">
    <summary><span id="number">01</span><b data-cms-path="practices.0.name">Инь-йога</b></summary>
    <p id="about" data-cms-path="practices.0.about">Долгие позы</p>
  </details>
  <details id="qigong">
    <summary>Цигун</summary>
    <p data-cms-path="practices.1.about">Плавно</p>
  </details>
  <section id="result" data-cms-reveal hidden>
    <p id="advice" data-cms-path="quiz.advice">Начните с инь-йоги</p>
  </section>`;

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`No ${selector} in the page`);
  return found;
}

function details(id: string): HTMLDetailsElement {
  const found = document.querySelector<HTMLDetailsElement>(`details#${id}`);
  if (found === null) throw new Error(`No details #${id} in the page`);
  return found;
}

beforeEach(() => {
  document.body.innerHTML = PAGE;
});

describe("revealing what a page hides", () => {
  it("opens the details and the revealed parts around a field", () => {
    const shown = vi.fn();
    document.addEventListener(REVEAL_EVENT, shown);

    revealAround(element("#about"));
    revealAround(element("#advice"));

    expect(details("yin").open).toBe(true);
    expect(details("qigong").open).toBe(false);
    expect(element("#result").hasAttribute("data-cms-revealed")).toBe(true);
    expect(shown).toHaveBeenCalledTimes(1);
    document.removeEventListener(REVEAL_EVENT, shown);
  });

  it("tells the site once about a part revealed again", () => {
    const shown = vi.fn();
    element("#result").addEventListener(REVEAL_EVENT, shown);

    revealAround(element("#advice"));
    revealAround(element("#advice"));

    expect(shown).toHaveBeenCalledTimes(1);
  });

  it("opens again in a page rendered anew what was open", () => {
    revealAround(element("#about"));
    revealAround(element("#advice"));
    const revealed = revealedPartsOf(document);

    replacePageBody(document, `<html><body>${PAGE}</body></html>`);

    expect(details("yin").open).toBe(true);
    expect(details("qigong").open).toBe(false);
    expect(element("#result").hasAttribute("data-cms-revealed")).toBe(true);

    document.body.innerHTML = PAGE;
    restoreRevealedParts(document, revealed);
    expect(details("yin").open).toBe(true);
  });

  it("opens again the same parts when the draft adds one before them", () => {
    const practice = (index: number) =>
      `<details><summary data-cms-path="practices.${String(index)}.name">Практика</summary></details>`;
    document.body.innerHTML = practice(0) + practice(1);
    revealAround(element('[data-cms-path="practices.1.name"]'));
    const revealed = revealedPartsOf(document);

    const news = `<details><summary data-cms-path="news.0.title">Новость</summary></details>`;
    document.body.innerHTML = news + practice(0) + practice(1);
    restoreRevealedParts(document, revealed);

    const open = [...document.querySelectorAll("details")].map(
      (part) => part.open,
    );
    expect(open).toEqual([false, false, true]);
  });
});

describe("a click on the summary of details", () => {
  const listeners: PageListeners = {
    onHover: vi.fn(),
    onClick: vi.fn(),
    onLinkHover: vi.fn(),
    onLinkClick: vi.fn(),
    onKeyDown: vi.fn(),
    onFileDragOver: vi.fn(() => false),
    onFileDragEnd: vi.fn(),
    onFileDrop: vi.fn(),
    onLayoutChange: vi.fn(),
  };

  function click(selector: string): void {
    element(selector).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  }

  it("opens it, also on a field, and closes it only off the fields", () => {
    const stop = listenToPage(document, listeners);

    click("#yin b");
    expect(details("yin").open).toBe(true);
    expect(listeners.onClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "practices.0.name" }),
    );

    click("#yin b");
    expect(details("yin").open).toBe(true);

    click("#number");
    expect(details("yin").open).toBe(false);
    stop();
  });

  it("leaves details alone on a click inside them", () => {
    const stop = listenToPage(document, listeners);
    details("yin").open = true;

    click("#about");

    expect(details("yin").open).toBe(true);
    stop();
  });
});

describe("a click on a switch of the page", () => {
  const TABS = `
    <fieldset>
      <input type="radio" name="cafe" id="first" checked><label for="first">Московская</label>
      <input type="radio" name="cafe" id="second"><label for="second" id="second-label">Ленина</label>
      <label id="vegan-label"><input type="checkbox" id="vegan"> Только веганское</label>
      <label><input type="checkbox" id="marked"><b data-cms-path="menu.filter">Фильтр</b></label>
    </fieldset>
    <section data-cms-path="menu.0.title">Капучино</section>`;
  const listeners: PageListeners = {
    onHover: vi.fn(),
    onClick: vi.fn(),
    onLinkHover: vi.fn(),
    onLinkClick: vi.fn(),
    onKeyDown: vi.fn(),
    onFileDragOver: vi.fn(() => false),
    onFileDragEnd: vi.fn(),
    onFileDrop: vi.fn(),
    onLayoutChange: vi.fn(),
  };

  function input(id: string): HTMLInputElement {
    const found = document.querySelector<HTMLInputElement>(`input#${id}`);
    if (found === null) throw new Error(`No input #${id} in the page`);
    return found;
  }

  function click(selector: string): void {
    element(selector).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  }

  beforeEach(() => {
    document.body.innerHTML = TABS;
  });

  it("switches a tab by its label and tells the site", () => {
    const changed = vi.fn();
    document.addEventListener("change", changed);
    const stop = listenToPage(document, listeners);

    click("#second-label");

    expect(input("second").checked).toBe(true);
    expect(input("first").checked).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(listeners.onLayoutChange).toHaveBeenCalled();
    stop();
    document.removeEventListener("change", changed);
  });

  it("flips a checkbox, but not on a click that chooses a field in its label", () => {
    const stop = listenToPage(document, listeners);

    click("#vegan-label");
    expect(input("vegan").checked).toBe(true);
    click("#vegan");
    expect(input("vegan").checked).toBe(false);

    click("[data-cms-path='menu.filter']");
    expect(input("marked").checked).toBe(false);
    stop();
  });

  it("keeps the picked tab in a page rendered anew", () => {
    const stop = listenToPage(document, listeners);
    click("#second-label");
    stop();

    replacePageBody(document, `<html><body>${TABS}</body></html>`);

    expect(input("second").checked).toBe(true);
    expect(input("first").checked).toBe(false);
  });
});
