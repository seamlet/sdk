// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureLayout } from "./page-layout";

beforeEach(() => {
  document.body.innerHTML = `
    <h1 data-cms-path="title">Зерно</h1>
    <p data-cms-path="hero.subtitle" hidden></p>
    <a href="/menu">Меню</a>`;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return this.hasAttribute("hidden")
        ? new DOMRect(0, 0, 0, 0)
        : new DOMRect(20, 100, 300, 40);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("measureLayout", () => {
  it("gives the boxes of the marked elements that take space and of the hovered link", () => {
    const link = document.querySelector("a");
    if (link === null) throw new Error("The page has no link");

    const layout = measureLayout(document, { element: link, href: "/menu" });

    const box = { top: 100, left: 20, width: 300, height: 40 };
    expect(layout.markers).toEqual([{ path: "title", box }]);
    expect(layout.link).toEqual({ href: "/menu", box });
  });
});
