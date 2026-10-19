// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { makeEditable, makeUneditable } from "./editable-elements";

function heading(style?: string): HTMLElement {
  const element = document.createElement("h1");
  if (style !== undefined) element.setAttribute("style", style);
  return element;
}

describe("makeEditable", () => {
  it("makes the element editable without the browser's focus ring", () => {
    const element = heading();

    makeEditable(element, "plaintext-only");

    expect(element.getAttribute("contenteditable")).toBe("plaintext-only");
    expect(element.style.getPropertyValue("outline")).toBe("none");
    expect(element.style.getPropertyPriority("outline")).toBe("important");
  });

  it("gives the element back as it was", () => {
    const element = heading();

    makeEditable(element, "true");
    makeUneditable(element);

    expect(element.hasAttribute("contenteditable")).toBe(false);
    expect(element.hasAttribute("style")).toBe(false);
  });

  it("keeps the site's own outline and other styles", () => {
    const element = heading("color: red; outline: 2px solid blue");

    makeEditable(element, "plaintext-only");
    makeEditable(element, "plaintext-only");
    makeUneditable(element);

    expect(element.style.getPropertyValue("outline")).toBe("2px solid blue");
    expect(element.style.getPropertyValue("color")).toBe("red");
  });
});
