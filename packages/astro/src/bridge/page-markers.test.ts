// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  findClosestMarkedElement,
  findMarkedElement,
  hasMarkedDescendants,
  markedElementAround,
} from "./page-markers";

beforeEach(() => {
  document.body.innerHTML = `
    <ul>
      <li data-cms-path="menu.0">
        <h3 data-cms-path="menu.0.name"><span>Эспрессо</span></h3>
        <p>Без описания</p>
      </li>
    </ul>
    <p id="outside">Вне полей</p>`;
});

function element(selector: string): Element {
  const found = document.querySelector(selector);
  if (found === null) throw new Error(`No ${selector} in the page`);
  return found;
}

describe("page markers", () => {
  it("finds the closest marked element around a target", () => {
    expect(markedElementAround(element("span"))?.path).toBe("menu.0.name");
    expect(markedElementAround(element("li p"))?.path).toBe("menu.0");
    expect(markedElementAround(element("#outside"))).toBeUndefined();
    expect(markedElementAround(null)).toBeUndefined();
  });

  it("finds an element by its path and by the closest marked path around it", () => {
    expect(findMarkedElement(document, "menu.0.name")?.tagName).toBe("H3");
    expect(findMarkedElement(document, "menu.0.price")).toBeUndefined();
    expect(
      findClosestMarkedElement(document, ["menu", 0, "price"])?.tagName,
    ).toBe("LI");
    expect(findClosestMarkedElement(document, ["contacts"])).toBeUndefined();
  });

  it("tells whether an element holds other marked elements", () => {
    expect(hasMarkedDescendants(element("li"))).toBe(true);
    expect(hasMarkedDescendants(element("h3"))).toBe(false);
  });
});
